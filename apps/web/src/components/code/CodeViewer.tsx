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
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-slate-50/70 shrink-0">
        <div className="flex items-center space-x-2.5 truncate">
          <Code2 className="w-4 h-4 text-indigo shrink-0" />
          <div className="truncate">
            <div className="flex items-center space-x-2 text-[14px] font-mono text-text-primary font-medium">
              <span className="truncate">{filePath}</span>
              <span className="px-2 py-0.5 rounded bg-indigo-tint text-indigo font-mono text-[12px] font-semibold">
                L{startLine}–L{endLine}
              </span>
            </div>
            {symbolName && (
              <div className="text-[12px] text-indigo font-mono truncate mt-0.5">
                symbol: {symbolName}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0 ml-3">
          <button
            onClick={handleCopy}
            className="h-8 px-2.5 text-text-secondary hover:text-text-primary hover:bg-slate-200/60 rounded-lg transition-colors text-[13px] flex items-center gap-1.5"
            title="Copy Snippet"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-teal" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-slate-200/60 rounded-lg transition-colors"
              title="Open in GitHub"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-slate-200/60 rounded-lg transition-colors ml-1"
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
            <div className="p-6 font-mono text-[14px] text-text-secondary bg-slate-50 h-full overflow-auto leading-relaxed">
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
              fontSize: 14,
              lineHeight: 22,
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              renderLineHighlight: 'all',
              lineNumbers: 'on',
              folding: true,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
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
                        className: 'bg-indigo-tint/70 border-l-2 border-indigo',
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
