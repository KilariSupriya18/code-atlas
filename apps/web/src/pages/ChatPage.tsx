import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
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
  MessageSquare,
  CornerDownLeft,
} from 'lucide-react';
import { api, Citation, ChatThread, ChatMessage } from '../api/client';
import { CodeViewer } from '../components/code/CodeViewer';

export const ChatPage: React.FC = () => {
  const { repoId } = useParams<{ repoId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const executedInitialRef = useRef(false);

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

  // Auto-select first thread if none in URL
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
        const newThread = await api.createThread(repoId, messageText.slice(0, 45));
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

  // Wire initial question from Overview page (execute exactly once)
  useEffect(() => {
    const initialQ = (location.state as any)?.initialQuestion;
    if (initialQ && !executedInitialRef.current) {
      executedInitialRef.current = true;
      handleSend(initialQ);
      // Clear location state so back/forward or reload doesn't trigger duplicate submissions
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Threads Sidebar (240px) */}
      <div className="w-60 border-r border-border bg-surface flex flex-col shrink-0 hidden md:flex">
        <div className="p-3.5 border-b border-border">
          <button
            onClick={handleNewThread}
            className="w-full h-11 px-3 text-[14px] font-medium text-text-primary bg-slate-50 hover:bg-slate-100 border border-border rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4 text-indigo" />
            <span>New Conversation</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            Recent Questions
          </div>
          {threads?.map((t) => (
            <button
              key={t.id}
              onClick={() => setSearchParams({ threadId: t.id })}
              className={`w-full text-left px-3 h-11 text-[14px] rounded-xl truncate transition-colors flex items-center ${
                t.id === threadId
                  ? 'bg-indigo-tint text-indigo font-semibold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
              }`}
            >
              <MessageSquare className={`w-4 h-4 mr-2.5 shrink-0 ${t.id === threadId ? 'text-indigo' : 'text-text-secondary/70'}`} />
              <span className="truncate">{t.title || 'Untitled Thread'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Stream Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-canvas overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {(!threadData?.messages || threadData.messages.length === 0) && (
            <div className="max-w-2xl mx-auto py-12 text-center space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-tint text-indigo flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                  Find your starting point.
                </h2>
                <p className="text-[16px] text-text-secondary leading-relaxed max-w-lg mx-auto">
                  Ask any question about control flow, validation rules, or dependencies. Answers are verified against repository source code with exact line citations.
                </p>
              </div>

              {/* Starter chips */}
              <div className="pt-3 grid sm:grid-cols-2 gap-2.5 max-w-xl mx-auto">
                {starterQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-left p-4 rounded-xl bg-surface border border-border hover:border-indigo-border hover:bg-indigo-tint/40 text-[14px] text-text-primary font-medium transition-all flex items-center justify-between group shadow-xs"
                  >
                    <span>{q}</span>
                    <ArrowUpRight className="w-4 h-4 text-text-secondary group-hover:text-indigo transition-colors shrink-0 ml-2" />
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
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-3xl mx-auto w-full`}
              >
                <div className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5 px-1">
                  {isUser ? 'You' : 'CodeAtlas Assistant'}
                </div>

                <div
                  className={`p-6 rounded-2xl text-[16px] leading-[1.65] space-y-4 shadow-xs ${
                    isUser
                      ? 'bg-indigo text-white max-w-xl font-medium'
                      : 'bg-surface border border-border text-text-primary w-full'
                  }`}
                >
                  {/* Message body */}
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Citation chips */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="pt-4 border-t border-border/80">
                      <div className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-2.5">
                        Verified Source Evidence ({msg.citations.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cit, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleCitationClick(cit)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-tint/80 hover:bg-indigo hover:text-white border border-indigo-border/80 text-indigo transition-colors text-[13px] font-mono group shadow-2xs"
                            title={cit.claim || cit.file_path}
                          >
                            <FileCode className="w-3.5 h-3.5 group-hover:text-white shrink-0" />
                            <span className="truncate max-w-[180px]">{cit.file_path}</span>
                            <span className="opacity-75">
                              :L{cit.start_line}–L{cit.end_line}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Uncertainties note if present */}
                  {!isUser && msg.uncertainties && msg.uncertainties.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-tint/60 border border-amber-border text-amber text-[13px] flex items-start gap-2.5">
                      <HelpCircle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Caveat / Uncertainty: </span>
                        {msg.uncertainties.join(' ')}
                      </div>
                    </div>
                  )}

                  {/* Suggested follow-ups */}
                  {!isUser && msg.suggested_questions && msg.suggested_questions.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      {msg.suggested_questions.map((sq, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => handleSend(sq)}
                          className="text-[13px] text-text-secondary hover:text-indigo hover:bg-indigo-tint bg-slate-50 px-3 py-1.5 rounded-lg border border-border transition-colors flex items-center gap-1.5"
                        >
                          <span>→ {sq}</span>
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
            <div className="flex flex-col items-start max-w-3xl mx-auto w-full">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5 px-1">
                CodeAtlas Assistant
              </div>
              <div className="p-6 rounded-2xl bg-surface border border-border text-[15px] text-text-secondary flex items-center space-x-3 shadow-xs">
                <Loader2 className="w-5 h-5 animate-spin text-indigo" />
                <span>Searching Qdrant, computing RRF fusion, and generating grounded answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Composer (minimum height ~56px) */}
        <div className="p-5 bg-surface border-t border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="max-w-3xl mx-auto relative"
          >
            <div className="relative flex items-end border border-border rounded-2xl bg-canvas focus-within:border-indigo focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo transition-all shadow-xs">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask where logic lives, how errors are handled, or inspect a function..."
                disabled={sendMutation.isPending}
                className="w-full min-h-[56px] max-h-36 py-3.5 pl-4 pr-28 text-[15px] bg-transparent resize-none focus:outline-none text-text-primary placeholder:text-text-secondary/60 leading-relaxed"
              />
              <div className="absolute right-2.5 bottom-2.5 flex items-center space-x-2">
                <button
                  type="submit"
                  disabled={sendMutation.isPending || !input.trim()}
                  className="h-10 px-4 text-[14px] font-medium text-white bg-indigo hover:bg-indigo-hover disabled:opacity-40 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send</span>
                      <CornerDownLeft className="w-3.5 h-3.5 opacity-70" />
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="text-[12px] text-text-secondary/70 mt-1.5 text-right pr-2">
              Press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">Enter</kbd> to send, <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">Shift+Enter</kbd> for newline
            </div>
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
