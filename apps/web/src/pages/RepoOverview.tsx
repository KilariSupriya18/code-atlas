import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderGit2,
  GitBranch,
  GitCommit,
  Layers,
  Code2,
  FileCode,
  MessageSquare,
  GraduationCap,
  RefreshCw,
  ArrowRight,
  Search,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { CodeViewer } from '../components/code/CodeViewer';

export const RepoOverviewPage: React.FC = () => {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();

  const [questionInput, setQuestionInput] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  const { data: repoData, isLoading: repoLoading } = useQuery({
    queryKey: ['repository', repoId],
    queryFn: () => (repoId ? api.getRepository(repoId) : null),
    enabled: !!repoId,
  });

  const { data: files } = useQuery({
    queryKey: ['repo-files', repoId],
    queryFn: () => (repoId ? api.listFiles(repoId) : []),
    enabled: !!repoId,
  });

  const { data: paths } = useQuery({
    queryKey: ['learning-paths', repoId],
    queryFn: () => (repoId ? api.listLearningPaths(repoId) : []),
    enabled: !!repoId,
  });

  const repo = repoData?.repository;
  const snapshot = repoData?.current_snapshot;
  const activePath = paths && paths.length > 0 ? paths[0] : null;

  const handleOpenFile = async (path: string) => {
    if (!repoId) return;
    try {
      const src = await api.getSource(repoId, path);
      setSelectedFile(path);
      setFileContent(src.content);
    } catch (err) {
      console.error('Failed to load source', err);
    }
  };

  const handleReindex = async () => {
    if (!repoId) return;
    const res = await api.reindexRepository(repoId);
    navigate(`/app/repositories/${repoId}/indexing?jobId=${res.job_id}`);
  };

  const handleAsk = (q: string) => {
    const query = q.trim();
    if (!query || !repoId) return;
    navigate(`/app/repositories/${repoId}/chat`, {
      state: { initialQuestion: query },
    });
  };

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    if (!fileFilter.trim()) return files;
    const lower = fileFilter.toLowerCase();
    return files.filter(f => f.path.toLowerCase().includes(lower) || f.language.toLowerCase().includes(lower));
  }, [files, fileFilter]);

  if (repoLoading) {
    return (
      <div className="p-12 text-center text-base text-text-secondary">
        Loading workspace overview...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Overview Main Column */}
      <div className={`flex-1 overflow-auto p-8 space-y-8 ${selectedFile ? 'max-w-4xl' : 'max-w-6xl'} mx-auto transition-all`}>
        
        {/* 1. Opening Section */}
        <div className="space-y-3 pb-6 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-text-secondary">
              YOUR WORKSPACE
            </span>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleReindex}
                className="h-9 px-3.5 text-[14px] font-medium text-text-primary bg-surface border border-border hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-text-secondary" />
                <span>Re-index</span>
              </button>

              {repo?.url && !repo.url.includes('demo') && (
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3.5 text-[14px] font-medium text-text-secondary hover:text-text-primary bg-surface border border-border hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Repository</span>
                </a>
              )}
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
            {repo?.name || 'Repository Overview'}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <p className="text-[16px] text-text-secondary max-w-2xl leading-relaxed">
              Explore the code. Find your starting point.
            </p>

            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[13px] font-medium bg-teal-tint text-teal border border-teal-border/70">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Snapshot ready
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-mono text-text-secondary bg-slate-100 border border-border/80">
                <GitBranch className="w-3.5 h-3.5 mr-1" />
                {snapshot?.branch || repo?.default_branch || 'main'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Compact Horizontal Facts Strip */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="space-y-1">
              <div className="text-[13px] font-medium text-text-secondary uppercase tracking-wider">
                Files Indexed
              </div>
              <div className="text-3xl font-bold text-text-primary tracking-tight">
                {snapshot?.file_count ?? 0}
              </div>
              <div className="text-[13px] text-text-secondary">
                canonical source files
              </div>
            </div>

            <div className="space-y-1 md:pl-6 pt-4 md:pt-0">
              <div className="text-[13px] font-medium text-text-secondary uppercase tracking-wider">
                Functions & Classes
              </div>
              <div className="text-3xl font-bold text-text-primary tracking-tight">
                {snapshot?.symbol_count ?? 0}
              </div>
              <div className="text-[13px] text-text-secondary">
                parsed AST symbols
              </div>
            </div>

            <div className="space-y-1 md:pl-6 pt-4 md:pt-0">
              <div className="text-[13px] font-medium text-text-secondary uppercase tracking-wider">
                Vector Chunks
              </div>
              <div className="text-3xl font-bold text-text-primary tracking-tight">
                {snapshot?.chunk_count ?? 0}
              </div>
              <div className="text-[13px] text-text-secondary">
                384-dim dense embeddings
              </div>
            </div>

            <div className="space-y-1 md:pl-6 pt-4 md:pt-0">
              <div className="text-[13px] font-medium text-text-secondary uppercase tracking-wider">
                Commit Snapshot
              </div>
              <div className="text-lg font-bold font-mono text-text-primary tracking-tight pt-1 truncate" title={snapshot?.commit_sha}>
                {snapshot?.commit_sha ? snapshot.commit_sha.slice(0, 10) : 'main'}
              </div>
              <div className="text-[13px] text-text-secondary">
                verified tree-sitter state
              </div>
            </div>
          </div>
        </div>

        {/* 3. Primary Working Area: Asymmetric 60/40 Layout */}
        <div className="grid lg:grid-cols-12 gap-6 items-stretch">
          {/* Ask Panel (approx 60% = 7 cols) */}
          <div className="lg:col-span-7 bg-indigo-tint/60 border border-indigo-border/80 rounded-2xl p-7 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo text-white flex items-center justify-center shadow-xs mb-3">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h2 className="text-[22px] font-bold text-text-primary tracking-tight">
                What do you want to understand?
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed">
                Ask natural language questions to trace control flow, contracts, and error handling with exact source citations.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk(questionInput);
              }}
              className="space-y-3"
            >
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="e.g., Where is authentication handled?"
                  className="flex-1 h-12 px-4 text-[15px] bg-white border border-indigo-border/80 rounded-xl focus:outline-none focus:border-indigo shadow-xs placeholder:text-text-secondary/60 text-text-primary"
                />
                <button
                  type="submit"
                  disabled={!questionInput.trim()}
                  className="h-12 px-6 text-[15px] font-medium text-white bg-indigo hover:bg-indigo-hover disabled:opacity-50 rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center gap-2"
                >
                  <span>Ask Codebase</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Suggested Prompts */}
              <div className="pt-2">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
                  Suggested questions
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Where is authentication handled?',
                    'What are the main entry points?',
                    'How are errors handled?',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleAsk(prompt)}
                      className="px-3 py-1.5 text-[13px] font-medium text-indigo bg-white hover:bg-indigo-tint border border-indigo-border/60 rounded-lg shadow-2xs transition-colors text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>

          {/* Learning Panel (approx 40% = 5 cols) */}
          <div className="lg:col-span-5 bg-teal-tint/60 border border-teal-border/80 rounded-2xl p-7 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-teal text-white flex items-center justify-center shadow-xs mb-3">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h2 className="text-[22px] font-bold text-text-primary tracking-tight">
                Find your way through the code.
              </h2>
              <p className="text-[15px] text-text-secondary leading-relaxed">
                Work through progressive lessons grounded in parsed code with check-for-understanding exercises.
              </p>
            </div>

            {/* Dynamic Status / Action */}
            <div className="space-y-4 pt-2">
              {activePath ? (
                <div className="bg-white border border-teal-border/80 rounded-xl p-4 shadow-2xs space-y-2">
                  <div className="text-[12px] font-semibold text-teal uppercase tracking-wider">
                    Current Learning Path
                  </div>
                  <div className="text-[15px] font-bold text-text-primary line-clamp-2">
                    {activePath.goal}
                  </div>
                  <div className="text-[13px] text-text-secondary">
                    {activePath.lessons.length} lessons in curriculum
                  </div>
                </div>
              ) : (
                <div className="text-[14px] text-text-secondary italic">
                  No active learning path yet. Set a learning goal to generate your personalized curriculum.
                </div>
              )}

              <Link
                to={activePath ? `/app/repositories/${repoId}/learn/${activePath.id}` : `/app/repositories/${repoId}/learn`}
                className="w-full h-12 px-6 text-[15px] font-medium text-white bg-teal hover:bg-teal-hover rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>{activePath ? 'Continue learning' : 'Start a learning path'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* 4. Source Files Section */}
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center space-x-3">
              <h3 className="text-[22px] font-bold text-text-primary tracking-tight">
                Source files
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[13px] font-mono text-text-secondary bg-slate-100 border border-border/80">
                {files?.length ?? 0}
              </span>
            </div>

            {/* Filename Filter Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-text-secondary absolute left-3 top-3" />
              <input
                type="text"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                placeholder="Filter files..."
                className="w-full h-10 pl-9 pr-3 text-[14px] bg-slate-50 border border-border rounded-xl focus:bg-white focus:outline-none focus:border-indigo transition-colors"
              />
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {filteredFiles.length === 0 ? (
              <div className="py-8 text-center text-[15px] text-text-secondary">
                No matching files found.
              </div>
            ) : (
              filteredFiles.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleOpenFile(f.path)}
                  className={`w-full flex items-center justify-between py-3.5 px-3 text-left rounded-xl transition-colors ${
                    selectedFile === f.path ? 'bg-indigo-tint/60 text-indigo font-semibold' : 'hover:bg-slate-50 text-text-primary'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <FileCode className={`w-4 h-4 shrink-0 ${selectedFile === f.path ? 'text-indigo' : 'text-text-secondary'}`} />
                    <span className="font-mono text-[14px] truncate">{f.path}</span>
                  </div>

                  <div className="flex items-center space-x-4 shrink-0 text-text-secondary text-[13px] font-mono">
                    <span>{(f.size / 1024).toFixed(1)} KB</span>
                    <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-[12px]">
                      {f.language}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Side Code Viewer Panel */}
      {selectedFile && fileContent !== null && (
        <div className="w-5/12 h-full shrink-0">
          <CodeViewer
            filePath={selectedFile}
            startLine={1}
            endLine={40}
            content={fileContent}
            repoUrl={repo?.url}
            commitSha={snapshot?.commit_sha}
            onClose={() => {
              setSelectedFile(null);
              setFileContent(null);
            }}
          />
        </div>
      )}
    </div>
  );
};
