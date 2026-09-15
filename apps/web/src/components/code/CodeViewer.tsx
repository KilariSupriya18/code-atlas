import React, { useState, lazy, Suspense } from 'react';
import { Copy, Check, ExternalLink, X, Code2 } from 'lucide-react';

const Editor = lazy(() => import('@monaco-editor/react'));

interface CodeViewerProps {
  filePath: string;
  symbolName?: string;
  startLine: number;
  endLine: number;
  content: string;
  repoUrl?: string;
  commitSha?: string;
  onClose?: () => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  filePath,
  symbolName,
  startLine,
  endLine,
  content,
  repoUrl,
  commitSha,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // If lines are specified, extract that snippet
    const lines = content.split('\n');
    const snippet = lines.slice(Math.max(0, startLine - 1), endLine).join('\n');
    navigator.clipboard.writeText(snippet || content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const githubUrl = repoUrl && commitSha && !repoUrl.includes('demo')
    ? `${repoUrl.replace(/\.git$/, '')}/blob/${commitSha}/${filePath}#L${startLine}-L${endLine}`
    : null;

  return (
    <div className="flex flex-col h-full bg-white border-l border-border shadow-sm">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50/50">
        <div className="flex items-center space-x-2 truncate">
          <Code2 className="w-4 h-4 text-primary shrink-0" />
          <div className="truncate">
            <div className="flex items-center space-x-2 text-xs font-mono text-text-primary font-medium">
              <span className="truncate">{filePath}</span>
              <span className="text-text-secondary">
                L{startLine}–L{endLine}
              </span>
            </div>
            {symbolName && (
              <div className="text-[11px] text-primary font-mono truncate">
                {symbolName}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-2">
          <button
            onClick={handleCopy}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-slate-100 rounded transition-colors text-xs flex items-center gap-1"
            title="Copy Snippet"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-slate-100 rounded transition-colors"
              title="Open in GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-slate-100 rounded transition-colors"
              title="Close Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Code Area */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <Suspense
          fallback={
            <div className="p-4 font-mono text-xs text-text-secondary bg-slate-50 h-full overflow-auto">
              <pre>{content}</pre>
            </div>
          }
        >
          <Editor
            height="100%"
            language={filePath.endsWith('.py') ? 'python' : filePath.endsWith('.md') ? 'markdown' : 'plaintext'}
            value={content}
            theme="vs"
            options={{
              readOnly: true,
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              renderLineHighlight: 'all',
              lineNumbers: 'on',
              folding: true,
              wordWrap: 'on',
            }}
            onMount={(editor) => {
              // Center view on targeted startLine
              if (startLine > 0) {
                editor.revealLineInCenter(startLine);
                editor.deltaDecorations(
                  [],
                  [
                    {
                      range: {
                        startLineNumber: startLine,
                        startColumn: 1,
                        endLineNumber: endLine,
                        endColumn: 1,
                      },
                      options: {
                        isWholeLine: true,
                        className: 'bg-primary-light/60 border-l-2 border-primary',
                      },
                    },
                  ]
                );
              }
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};
