import { Search, Moon, Sun, X, Database, Workflow } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '../types';
import { DatabaseLogoIcon } from './ui/DatabaseLogos';

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      const results: SearchResult[] = [];
      const query = searchQuery.toLowerCase();

      try {
        // Search pipelines
        const { data: pipelines } = await supabase
          .from('pipelines')
          .select('id, name')
          .ilike('name', `%${query}%`)
          .limit(5);

        if (pipelines) {
          pipelines.forEach(p => {
            results.push({
              id: p.id,
              type: 'pipeline',
              title: `Pipeline: ${p.name}`,
            });
          });
        }

        // Search source connectors - in connector name
        const { data: sourceByName } = await supabase
          .from('pipeline_connectors')
          .select(`
            id,
            name,
            pipeline_id,
            type,
            connector_class,
            pipelines!inner(name)
          `)
          .eq('type', 'source')
          .ilike('name', `%${query}%`)
          .limit(10);

        // Search source connectors - in connector class
        const { data: sourceByClass } = await supabase
          .from('pipeline_connectors')
          .select(`
            id,
            name,
            pipeline_id,
            type,
            connector_class,
            pipelines!inner(name)
          `)
          .eq('type', 'source')
          .ilike('connector_class', `%${query}%`)
          .limit(10);

        // Combine and deduplicate source connectors
        const sourceConnectorMap = new Map();
        [...(sourceByName || []), ...(sourceByClass || [])].forEach((c: any) => {
          if (!sourceConnectorMap.has(c.id)) {
            sourceConnectorMap.set(c.id, c);
            results.push({
              id: c.id,
              type: 'source_connector',
              title: `Source Connector: ${c.pipelines.name}`,
              subtitle: c.name,
              pipelineId: c.pipeline_id,
              connectorClass: c.connector_class,
              pipelineName: c.pipelines.name,
            });
          }
        });

        // Search destination connectors - in connector name
        const { data: sinkByName } = await supabase
          .from('pipeline_connectors')
          .select(`
            id,
            name,
            pipeline_id,
            type,
            connector_class,
            pipelines!inner(name)
          `)
          .eq('type', 'sink')
          .ilike('name', `%${query}%`)
          .limit(10);

        // Search destination connectors - in connector class
        const { data: sinkByClass } = await supabase
          .from('pipeline_connectors')
          .select(`
            id,
            name,
            pipeline_id,
            type,
            connector_class,
            pipelines!inner(name)
          `)
          .eq('type', 'sink')
          .ilike('connector_class', `%${query}%`)
          .limit(10);

        // Combine and deduplicate destination connectors
        const sinkConnectorMap = new Map();
        [...(sinkByName || []), ...(sinkByClass || [])].forEach((c: any) => {
          if (!sinkConnectorMap.has(c.id)) {
            sinkConnectorMap.set(c.id, c);
            results.push({
              id: c.id,
              type: 'destination_connector',
              title: `Destination Connector: ${c.pipelines.name}`,
              subtitle: c.name,
              pipelineId: c.pipeline_id,
              connectorClass: c.connector_class,
              pipelineName: c.pipelines.name,
            });
          }
        });

        // Limit total results to prevent overwhelming UI
        const limitedResults = results.slice(0, 15);
        setSearchResults(limitedResults);
        setShowResults(limitedResults.length > 0);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'pipeline') {
      navigate(`/pipelines/${result.id}`);
    } else {
      navigate(`/pipelines/${result.pipelineId}`);
    }
    setSearchQuery('');
    setShowResults(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-6 gap-4">
      <div className="flex-1 max-w-2xl" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="global-search"
            name="globalSearch"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder="Search pipelines, connectors..."
            className="w-full pl-10 pr-10 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No results found
                </div>
              ) : (
                <div className="py-2">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0 flex items-center gap-3"
                    >
                      {result.type === 'pipeline' ? (
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                          <Workflow className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      ) : result.connectorClass ? (
                        <DatabaseLogoIcon
                          connectorClass={result.connectorClass}
                          className="w-8 h-8 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {result.pipelineName || result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                            <span className="text-gray-400">→</span>
                            <span className="truncate">{result.subtitle}</span>
                          </div>
                        )}
                        {result.type !== 'pipeline' && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {result.type === 'source_connector' ? 'Source Connector' : 'Destination Connector'}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </button>
      </div>
    </header>
  );
}
