import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockWithCopyProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeBlockWithCopy({ code, language = 'sql', title }: CodeBlockWithCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 dark:bg-gray-950 rounded-lg overflow-hidden border border-gray-700">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
          <span className="text-sm font-medium text-gray-300">{title}</span>
          <span className="text-xs text-gray-500 uppercase">{language}</span>
        </div>
      )}
      <div className="relative">
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </button>
        <pre className="p-4 overflow-x-auto text-sm text-gray-100 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
