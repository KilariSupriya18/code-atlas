import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Loader2,
  FileCode,
  Sparkles,
  HelpCircle,
  Plus,
  ArrowUpRight,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { api, Citation, ChatThread, ChatMessage } from '../api/client';
import { CodeViewer } from '../components/code/CodeViewer';

export const ChatPage: React.FC = () => {
  const { repoId } = useParams<{ repoId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const threadId = searchParams.get('threadId');
  const [input, setInput] = useState('');
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [citationFileContent, setCitationFileContent] = useState<string | null>(null);

  // Starter questions
  const starterQuestions = [
    'Where is the authentication logic handled?',
    'What happens when a payment transaction fails?',
    'Where are database connections initialized and pooled?',
    'How does token refresh work in this service?',
  ];

  // Fetch threads
  const { data: threads } = useQuery({
    queryKey: ['chat-threads', repoId],
    queryFn: () => (repoId ? api.listThreads(repoId) : []),
    enabled: !!repoId,
  });

  // Fetch repository data for github links
  const { data: repoData } = useQuery({
    queryKey: ['repository', repoId],
    queryFn: () => (repoId ? api.getRepository(repoId) : null),
    enabled: !!repoId,
  });

  // Fetch current thread detail
  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['chat-thread', threadId],
    queryFn: () => (threadId ? api.getThread(threadId) : null),
    enabled: !!threadId,
  });

  // Auto-select or create first thread if none in URL
  useEffect(() => {
    if (!threadId && threads && threads.length > 0) {
      setSearchParams({ threadId: threads[0].id });
    }
  }, [threads, threadId, setSearchParams]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadData?.messages]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (messageText: string) => {
      let activeTid = threadId;
      if (!activeTid && repoId) {
        const newThread = await api.createThread(repoId, messageText.slice(0, 40));
        activeTid = newThread.id;
        setSearchParams({ threadId: newThread.id });
        queryClient.invalidateQueries({ queryKey: ['chat-threads', repoId] });
      }
      if (!activeTid) throw new Error('No thread active');
      return api.sendMessage(activeTid, messageText);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['chat-threads', repoId] });
      setInput('');
    },
  });

  const handleSend = (text?: string) => {
    const toSend = text || input;
    if (!toSend.trim() || sendMutation.isPending) return;
    sendMutation.mutate(toSend.trim());
  };

  const handleCitationClick = async (cit: Citation) => {
    if (!repoId) return;
    setActiveCitation(cit);
    try {
      const src = await api.getSource(repoId, cit.file_path);
      setCitationFileContent(src.content);
    } catch (err) {
      console.error('Failed to load citation file', err);
      setCitationFileContent(cit.snippet);
    }
  };

  const handleNewThread = async () => {
    if (!repoId) return;
    const newThread = await api.createThread(repoId, 'New Conversation');
    queryClient.invalidateQueries({ queryKey: ['chat-threads', repoId] });
    setSearchParams({ threadId: newThread.id });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Threads Mini Sidebar */}
      <div className="w-52 border-r border-border bg-surface flex flex-col shrink-0 hidden md:flex">
        <div className="p-3 border-b border-border">
          <button
            onClick={handleNewThread}
            className="w-full py-1.5 px-2.5 text-xs font-medium text-text-primary bg-slate-50 hover:bg-slate-100 border border-border rounded-md transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            New Question
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads?.map((t) => (
            <button
              key={t.id}
              onClick={() => setSearchParams({ threadId: t.id })}
              className={`w-full text-left px-2.5 py-2 text-xs rounded-md truncate transition-colors ${
                t.id === threadId
                  ? 'bg-primary-light text-primary font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
              }`}
            >
              {t.title || 'Untitled Thread'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Stream Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(!threadData?.messages || threadData.messages.length === 0) && (
            <div className="max-w-xl mx-auto py-12 text-center space-y-4">
              <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Ask anything about the codebase
                </h2>
                <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                  Answers are synthesized by Groq, strictly grounded in Qdrant-retrieved function chunks and verified citations.
                </p>
              </div>

              {/* Starter chips */}
              <div className="pt-2 flex flex-col gap-2 max-w-md mx-auto">
                {starterQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-left px-3.5 py-2 rounded-lg bg-surface border border-border hover:border-primary/40 hover:bg-slate-50 text-xs text-text-primary transition-all flex items-center justify-between group"
                  >
                    <span>{q}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-text-secondary group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Thread Messages */}
          {threadData?.messages?.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-2xl mx-auto w-full`}
              >
                <div className="text-[11px] font-medium text-text-secondary mb-1">
                  {isUser ? 'You' : 'CodeMentor Assistant'}
                </div>

                <div
                  className={`p-4 rounded-xl text-xs leading-relaxed space-y-3 shadow-sm ${
                    isUser
                      ? 'bg-primary text-white max-w-xl'
                      : 'bg-surface border border-border text-text-primary w-full'
                  }`}
                >
                  {/* Message body */}
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Citation chips */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="pt-3 border-t border-border/80">
                      <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
                        Source Evidence ({msg.citations.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cit, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleCitationClick(cit)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-50 hover:bg-primary-light border border-border hover:border-primary/50 text-text-primary hover:text-primary transition-colors text-[11px] font-mono group"
                          >
                            <FileCode className="w-3 h-3 text-text-secondary group-hover:text-primary" />
                            <span className="truncate max-w-[160px]">{cit.file_path}</span>
                            <span className="text-text-secondary">
                              :{cit.start_line}–{cit.end_line}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Uncertainties note if present */}
                  {!isUser && msg.uncertainties && msg.uncertainties.length > 0 && (
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-text-secondary text-[11px] flex items-start gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-text-secondary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Caveat / Uncertainty: </span>
                        {msg.uncertainties.join(' ')}
                      </div>
                    </div>
                  )}

                  {/* Suggested follow-ups */}
                  {!isUser && msg.suggested_questions && msg.suggested_questions.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {msg.suggested_questions.map((sq, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => handleSend(sq)}
                          className="text-[11px] text-text-secondary hover:text-primary bg-slate-50 hover:bg-primary-light px-2 py-1 rounded border border-border transition-colors"
                        >
                          → {sq}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pending loading indicator */}
          {sendMutation.isPending && (
            <div className="flex flex-col items-start max-w-2xl mx-auto w-full">
              <div className="text-[11px] font-medium text-text-secondary mb-1">
                CodeMentor Assistant
              </div>
              <div className="p-4 rounded-xl bg-surface border border-border text-xs text-text-secondary flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Searching Qdrant, computing RRF fusion, and generating grounded answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-surface border-t border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="max-w-3xl mx-auto relative flex items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask where logic lives, how errors are handled, or inspect a function..."
              disabled={sendMutation.isPending}
              className="w-full pl-4 pr-12 py-2.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-text-primary"
            />
            <button
              type="submit"
              disabled={sendMutation.isPending || !input.trim()}
              className="absolute right-2 p-1.5 bg-primary text-white hover:bg-primary-hover disabled:opacity-40 rounded-md transition-colors"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Persistent Code Evidence Viewer Panel */}
      {activeCitation && (
        <div className="w-5/12 h-full shrink-0">
          <CodeViewer
            filePath={activeCitation.file_path}
            symbolName={activeCitation.symbol_name}
            startLine={activeCitation.start_line}
            endLine={activeCitation.end_line}
            content={citationFileContent || activeCitation.snippet}
            repoUrl={repoData?.repository?.url}
            commitSha={repoData?.current_snapshot?.commit_sha}
            onClose={() => {
              setActiveCitation(null);
              setCitationFileContent(null);
            }}
          />
        </div>
      )}
    </div>
  );
};
