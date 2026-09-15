import React, { useState } from 'react';
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
  Database,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { CodeViewer } from '../components/code/CodeViewer';

export const RepoOverviewPage: React.FC = () => {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();

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

  const repo = repoData?.repository;
  const snapshot = repoData?.current_snapshot;

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

  if (repoLoading) {
    return <div className="p-8 text-center text-xs text-text-secondary">Loading repository overview...</div>;
  }

  return (
    <div className="flex h-full">
      {/* Overview Main Column */}
      <div className={`flex-1 overflow-auto p-8 space-y-6 ${selectedFile ? 'max-w-3xl' : 'max-w-6xl'} mx-auto transition-all`}>
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-text-secondary">
              <span>{repo?.url}</span>
            </div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1">
              {repo?.name}
            </h1>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleReindex}
              className="px-3 py-1.5 text-xs font-medium text-text-primary bg-surface border border-border hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-text-secondary" />
              Re-index
            </button>
            <Link
              to={`/app/repositories/${repoId}/chat`}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-md shadow-sm transition-colors flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask Codebase
            </Link>
          </div>
        </div>

        {/* Snapshot Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[11px] text-text-secondary flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5 text-primary" />
              Files Indexed
            </div>
            <div className="text-xl font-bold font-mono text-text-primary mt-1">
              {snapshot?.file_count ?? 0}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[11px] text-text-secondary flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5 text-indigo-600" />
              Functions & Classes
            </div>
            <div className="text-xl font-bold font-mono text-text-primary mt-1">
              {snapshot?.symbol_count ?? 0}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[11px] text-text-secondary flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              Vector Chunks
            </div>
            <div className="text-xl font-bold font-mono text-text-primary mt-1">
              {snapshot?.chunk_count ?? 0}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[11px] text-text-secondary flex items-center gap-1">
              <GitCommit className="w-3.5 h-3.5 text-slate-500" />
              Commit SHA
            </div>
            <div className="text-sm font-semibold font-mono text-text-primary mt-1 truncate" title={snapshot?.commit_sha}>
              {snapshot?.commit_sha?.slice(0, 8) || 'N/A'}
            </div>
          </div>
        </div>

        {/* Quick Launch Modes */}
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            to={`/app/repositories/${repoId}/chat`}
            className="group bg-surface border border-border hover:border-primary/50 rounded-xl p-5 transition-all shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary">
                Ask the Codebase
              </h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Query architecture, trace logic, identify validation flows, and inspect exact source evidence with line highlights.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-primary gap-1">
              Open Chat Assistant
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to={`/app/repositories/${repoId}/learn`}
            className="group bg-surface border border-border hover:border-emerald-500/50 rounded-xl p-5 transition-all shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary">
                Learn the Codebase
              </h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Start an adaptive onboarding track tailored to your goal and experience level, complete with exercises and remediation.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-emerald-600 gap-1">
              Start Learning Path
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {/* Indexed File Explorer */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Canonical Source Files ({files?.length ?? 0})
            </h3>
            <span className="text-[11px] text-text-secondary font-mono">
              Qdrant Payload Linked
            </span>
          </div>

          <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
            {files?.map((f) => (
              <button
                key={f.id}
                onClick={() => handleOpenFile(f.path)}
                className={`w-full flex items-center justify-between py-2 px-2.5 text-xs text-left hover:bg-slate-50 rounded transition-colors ${
                  selectedFile === f.path ? 'bg-primary-light font-medium text-primary' : 'text-text-primary'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileCode className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                  <span className="font-mono truncate">{f.path}</span>
                </div>
                <div className="flex items-center space-x-3 shrink-0 text-text-secondary text-[11px] font-mono">
                  <span>{(f.size / 1024).toFixed(1)} KB</span>
                  <span className="capitalize">{f.language}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Side Code Viewer Panel (35-40% width) */}
      {selectedFile && fileContent !== null && (
        <div className="w-5/12 h-full shrink-0">
          <CodeViewer
            filePath={selectedFile}
            startLine={1}
            endLine={30}
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
