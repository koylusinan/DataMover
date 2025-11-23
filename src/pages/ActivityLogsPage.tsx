import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { Activity, Search, Filter, Download, Loader2, Calendar, ChevronRight, ChevronDown, X, AlertCircle } from 'lucide-react';

interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  action_description: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export function ActivityLogsPage() {
  const { hasRole } = useAuth();
  const { showToast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    fetchLogs();

    const subscription = supabase
      .channel('user_activity_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_activity_logs',
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('user_activity_logs')
        .select(`
          *,
          user_profiles!user_activity_logs_user_id_fkey (
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      const { data, error } = await query;

      if (error) throw error;

      const logsWithUserInfo = (data || []).map((log: any) => ({
        ...log,
        user_email: log.user_profiles?.email || 'Unknown',
        user_name: log.user_profiles?.full_name || 'Unknown User',
      }));

      setLogs(logsWithUserInfo);
    } catch (error) {
      console.error('Error fetching logs:', error);
      showToast('error', 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionTypeColor = (actionType: string) => {
    if (actionType.includes('create') || actionType.includes('login')) {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
    if (actionType.includes('delete') || actionType.includes('logout')) {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
    if (actionType.includes('update')) {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('create')) return '✨';
    if (actionType.includes('delete')) return '🗑️';
    if (actionType.includes('update')) return '✏️';
    if (actionType.includes('login')) return '🔓';
    if (actionType.includes('logout')) return '🔒';
    return '📝';
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'Action Type', 'Description', 'Resource Type', 'Resource ID'].join(','),
      ...filteredLogs.map((log) =>
        [
          new Date(log.created_at).toISOString(),
          log.user_email,
          log.action_type,
          `"${log.action_description}"`,
          log.resource_type || '',
          log.resource_id || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast('success', 'Logs exported successfully');
  };

  const filterByDate = (log: ActivityLog) => {
    if (dateFilter === 'all') return true;

    const logDate = new Date(log.created_at);
    const now = new Date();

    switch (dateFilter) {
      case 'today':
        return logDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return logDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return logDate >= monthAgo;
      default:
        return true;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesActionType =
      actionTypeFilter === 'all' || log.action_type.startsWith(actionTypeFilter);

    const matchesDate = filterByDate(log);

    return matchesSearch && matchesActionType && matchesDate;
  });

  const actionTypes = Array.from(new Set(logs.map((log) => log.action_type.split('.')[0]))).sort();

  // Group logs by resource_id and time window (5 minutes)
  const groupedLogs = (() => {
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const groups: Array<{ mainLog: ActivityLog; subLogs: ActivityLog[] }> = [];

    for (const log of filteredLogs) {
      // Non-pipeline logs or logs without resource_id go in their own groups
      if (log.resource_type !== 'pipeline' || !log.resource_id) {
        groups.push({ mainLog: log, subLogs: [] });
        continue;
      }

      const logTime = new Date(log.created_at).getTime();

      // Find existing group for the same resource within time window
      let foundGroup = false;
      for (const group of groups) {
        if (group.mainLog.resource_id !== log.resource_id) continue;

        const groupTime = new Date(group.mainLog.created_at).getTime();
        const timeDiff = Math.abs(groupTime - logTime);

        // Check all logs in the group to see if this log fits in the time window
        const allLogsInGroup = [group.mainLog, ...group.subLogs];
        const fitsInWindow = allLogsInGroup.some(
          (groupLog) => Math.abs(new Date(groupLog.created_at).getTime() - logTime) < timeWindow
        );

        if (fitsInWindow) {
          // Add to this group
          if (log.action_type === 'pipeline.view') {
            // If current main is not a view, swap them
            if (group.mainLog.action_type !== 'pipeline.view') {
              group.subLogs.push(group.mainLog);
              group.mainLog = log;
            } else {
              // Already has a view as main, add this view to sub
              group.subLogs.push(log);
            }
          } else {
            // Non-view action, add to sub-logs
            group.subLogs.push(log);
          }
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        // Create new group
        groups.push({ mainLog: log, subLogs: [] });
      }
    }

    // Sort sub-logs by time within each group
    groups.forEach((group) => {
      group.subLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return groups;
  })();

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Activity Logs
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {hasRole('admin') ? 'View all system activity' : 'View your activity history'}
            </p>
          </div>
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            Export Logs
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={actionTypeFilter}
              onChange={(e) => setActionTypeFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Actions</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-400">
                Showing {filteredLogs.length} of {logs.length} logs
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-500 mt-1">
                Activity logs are retained for audit and compliance purposes
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
          <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Activity Logs
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || actionTypeFilter !== 'all' || dateFilter !== 'all'
              ? 'No logs match your search criteria'
              : 'No activity logs have been recorded yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {groupedLogs.map((group, idx) => {
              const { mainLog, subLogs } = group;
              const groupId = `${mainLog.id}-${idx}`;
              const isExpanded = expandedGroups.has(groupId);
              const hasSubLogs = subLogs.length > 0;

              console.log('Rendering log row:', {
                id: mainLog.id,
                action_type: mainLog.action_type,
                has_metadata: mainLog.metadata && Object.keys(mainLog.metadata).length > 0,
                metadata_keys: mainLog.metadata ? Object.keys(mainLog.metadata) : [],
                should_show_badge: mainLog.action_type.includes('update') && Object.keys(mainLog.metadata || {}).length > 0
              });

              return (
                <div key={groupId}>
                  {/* Main Log */}
                  <div
                    className={`p-6 transition-colors ${
                      mainLog.action_type.includes('update') && Object.keys(mainLog.metadata || {}).length > 0
                        ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                    onClick={(e) => {
                      console.log('🔥 LOG CARD CLICKED!', {
                        action_type: mainLog.action_type,
                        has_metadata: !!mainLog.metadata,
                        metadata_keys: Object.keys(mainLog.metadata || {}),
                        metadata: mainLog.metadata
                      });

                      if (mainLog.action_type.includes('update') && Object.keys(mainLog.metadata || {}).length > 0) {
                        console.log('✅ Opening modal for:', mainLog.id);
                        setSelectedLog(mainLog);
                      } else {
                        console.log('❌ Not opening modal - conditions not met');
                      }
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {hasSubLogs && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroup(groupId);
                          }}
                          className="mt-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          )}
                        </button>
                      )}
                      <div className="text-2xl">{getActionIcon(mainLog.action_type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getActionTypeColor(
                                  mainLog.action_type
                                )}`}
                              >
                                {mainLog.action_type}
                              </span>
                              {hasSubLogs && (
                                <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                  +{subLogs.length} action{subLogs.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {mainLog.resource_type && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {mainLog.resource_type}
                                </span>
                              )}
                              {mainLog.action_type.includes('update') && Object.keys(mainLog.metadata || {}).length > 0 && (
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                  📋 Click for details
                                </span>
                              )}
                            </div>
                            <p className="text-gray-900 dark:text-gray-100 font-medium">
                              {mainLog.action_description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(mainLog.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>
                            <span className="font-medium">User:</span> {mainLog.user_name || mainLog.user_email}
                          </span>
                          {mainLog.resource_id && (
                            <span>
                              <span className="font-medium">Resource ID:</span> {mainLog.resource_id.slice(0, 8)}...
                            </span>
                          )}
                        </div>

                        {Object.keys(mainLog.metadata || {}).length > 0 && (
                          <details className="mt-3" onClick={(e) => e.stopPropagation()}>
                            <summary className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                              View raw metadata
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs overflow-x-auto">
                              {JSON.stringify(mainLog.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sub Logs */}
                  {hasSubLogs && isExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-l-4 border-blue-500">
                      {subLogs.map((subLog) => (
                        <div
                          key={subLog.id}
                          className="p-6 pl-16 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-0"
                        >
                          <div className="flex items-start gap-4">
                            <div className="text-xl">{getActionIcon(subLog.action_type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span
                                      className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getActionTypeColor(
                                        subLog.action_type
                                      )}`}
                                    >
                                      {subLog.action_type}
                                    </span>
                                  </div>
                                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                                    {subLog.action_description}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {new Date(subLog.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              {Object.keys(subLog.metadata || {}).length > 0 && (
                                <details className="mt-3" onClick={(e) => e.stopPropagation()}>
                                  <summary className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                                    View raw metadata
                                  </summary>
                                  <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs overflow-x-auto">
                                    {JSON.stringify(subLog.metadata, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Update Details Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedLog(null);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Update Details</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {new Date(selectedLog.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedLog.metadata && (
                <div className="space-y-6">
                  {selectedLog.metadata.pipeline_name && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Pipeline</h3>
                      <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {selectedLog.metadata.pipeline_name as string}
                      </p>
                    </div>
                  )}

                  {selectedLog.metadata.connectors && Array.isArray(selectedLog.metadata.connectors) && (
                    <div className="space-y-4">
                      {(selectedLog.metadata.connectors as any[]).map((connector, idx) => (
                        <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              connector.type === 'source'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}>
                              {connector.type === 'source' ? 'Source' : 'Sink'}
                            </span>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {connector.name}
                            </h4>
                          </div>

                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {connector.connector_class}
                          </p>

                          {connector.changes && Array.isArray(connector.changes) && connector.changes.length > 0 ? (
                            <div className="space-y-3">
                              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Configuration Changes
                              </h5>
                              {connector.changes.map((change: any, changeIdx: number) => (
                                <div key={changeIdx} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
                                  <p className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                                    {change.field}
                                  </p>
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Old Value</p>
                                      <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-2 rounded border border-red-200 dark:border-red-800">
                                        <code className="text-xs break-all">
                                          {JSON.stringify(change.old_value)}
                                        </code>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">New Value</p>
                                      <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-2 rounded border border-green-200 dark:border-green-800">
                                        <code className="text-xs break-all">
                                          {JSON.stringify(change.new_value)}
                                        </code>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                              <AlertCircle className="w-4 h-4" />
                              <span>No configuration changes recorded</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
