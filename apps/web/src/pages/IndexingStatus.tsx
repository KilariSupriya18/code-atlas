import React, { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  FileCode,
  Layers,
  Database,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';

export const IndexingStatusPage: React.FC = () => {
  const { repoId } = useParams<{ repoId: string }>();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  const navigate = useNavigate();

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => (jobId ? api.getJob(jobId) : null),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.stage === 'ready' || data?.stage === 'failed') {
        return false;
      }
      return 1500; // Poll every 1.5 seconds
    },
    enabled: !!jobId,
  });

  const stages = [
    { key: 'queued', label: 'Queued', desc: 'Job initialized and waiting in worker queue' },
    { key: 'fetching', label: 'Fetching Source', desc: 'Cloning repository shallow tree and resolving commit SHA' },
    { key: 'parsing', label: 'AST & Symbol Parsing', desc: 'Extracting functions, classes, docstrings, and lines' },
    { key: 'embedding', label: 'Sentence Embeddings', desc: 'Computing 384-dim normalized vectors and writing to Qdrant' },
    { key: 'finalizing', label: 'Activating Snapshot', desc: 'Verifying collection indexes and publishing snapshot' },
  ];

  const currentStageIndex = stages.findIndex((s) => s.key === job?.stage);
  const isFinished = job?.stage === 'ready';
  const isFailed = job?.stage === 'failed';

  return (
    <div className="p-6 sm:p-10 max-w-3xl mx-auto space-y-8">
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-8 sm:p-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-text-secondary mb-1">
              PIPELINE PROGRESS
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              Repository Indexing
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Tracking real-time ingestion pipeline stages and vector database publishing.
            </p>
          </div>

          <div>
            {isFinished ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-teal-tint text-teal border border-teal/30">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Snapshot Ready
              </span>
            ) : isFailed ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-4 h-4 mr-1.5 text-red-500" />
                Indexing Failed
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-tint text-indigo border border-indigo/30">
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Processing
              </span>
            )}
          </div>
        </div>

        {/* Real Progress Metrics */}
        {job?.progress_stats && (
          <div className="grid grid-cols-3 gap-4 p-5 rounded-xl bg-canvas border border-border text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-text-primary">
                {job.progress_stats.files_parsed ?? 0}
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-text-secondary mt-1">
                Files Parsed
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-indigo">
                {job.progress_stats.symbols_extracted ?? 0}
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-text-secondary mt-1">
                Symbols Extracted
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-teal">
                {job.progress_stats.chunks_embedded ?? 0}
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-text-secondary mt-1">
                Vectors Embedded
              </div>
            </div>
          </div>
        )}

        {job?.progress_stats?.current_file && (
          <div className="px-4 py-2.5 bg-canvas rounded-lg border border-border text-xs font-mono text-text-secondary truncate flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5 text-indigo shrink-0" />
            <span className="truncate">Current: {job.progress_stats.current_file}</span>
          </div>
        )}

        {/* Pipeline Stage Steps with Connected Code-Path Motif */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-[2px] before:bg-border">
          {stages.map((stage, idx) => {
            const isCompleted = isFinished || (currentStageIndex > -1 && idx < currentStageIndex);
            const isCurrent = !isFinished && !isFailed && idx === currentStageIndex;

            return (
              <div key={stage.key} className="relative flex items-start gap-4 text-sm">
                <div className="shrink-0 -ml-6 mt-0.5">
                  {isCompleted ? (
                    <div className="w-6 h-6 rounded-full bg-teal text-white flex items-center justify-center ring-4 ring-surface shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-6 h-6 rounded-full bg-indigo text-white flex items-center justify-center ring-4 ring-indigo-tint shadow-sm animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-canvas text-text-secondary border border-border flex items-center justify-center ring-4 ring-surface text-xs font-mono">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-bold ${
                      isCompleted ? 'text-text-primary' : isCurrent ? 'text-indigo' : 'text-text-secondary'
                    }`}
                  >
                    {stage.label}
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    {stage.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Failure Message */}
        {isFailed && (
          <div className="mt-6 p-5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm space-y-3">
            <div className="font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Pipeline terminated with an error
            </div>
            <div className="font-mono text-xs bg-surface p-3 rounded-lg border border-red-200">
              {job?.error_message || 'Unknown error occurred during processing.'}
            </div>
            <button
              onClick={() => repoId && api.reindexRepository(repoId).then((r) => navigate(`/app/repositories/${repoId}/indexing?jobId=${r.job_id}`))}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Indexing
            </button>
          </div>
        )}

        {/* Ready Action */}
        {isFinished && (
          <div className="pt-6 border-t border-border flex items-center justify-end">
            <Link
              to={`/app/repositories/${repoId}/overview`}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo hover:bg-indigo-hover rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              View Repository Overview
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
