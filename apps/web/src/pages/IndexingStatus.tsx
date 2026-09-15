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
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="bg-surface border border-border rounded-xl shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">
              Repository Indexing
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Tracking real-time ingestion pipeline stages and vector database publishing.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {isFinished ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-success-light text-success border border-success-border">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Snapshot Ready
              </span>
            ) : isFailed ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-danger-light text-danger border border-danger-border">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Indexing Failed
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-light text-primary border border-blue-200">
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Processing
              </span>
            )}
          </div>
        </div>

        {/* Real Progress Metrics */}
        {job?.progress_stats && (
          <div className="grid grid-cols-3 gap-3 mb-6 p-4 rounded-lg bg-slate-50 border border-border text-center">
            <div>
              <div className="text-base font-bold font-mono text-text-primary">
                {job.progress_stats.files_parsed ?? 0}
              </div>
              <div className="text-[11px] text-text-secondary">Files Parsed</div>
            </div>
            <div>
              <div className="text-base font-bold font-mono text-text-primary">
                {job.progress_stats.symbols_extracted ?? 0}
              </div>
              <div className="text-[11px] text-text-secondary">Functions & Classes</div>
            </div>
            <div>
              <div className="text-base font-bold font-mono text-text-primary">
                {job.progress_stats.chunks_embedded ?? 0}
              </div>
              <div className="text-[11px] text-text-secondary">Vectors Embedded</div>
            </div>
          </div>
        )}

        {job?.progress_stats?.current_file && (
          <div className="mb-6 px-3 py-2 bg-slate-100/70 rounded border border-slate-200 text-xs font-mono text-text-secondary truncate">
            Current: {job.progress_stats.current_file}
          </div>
        )}

        {/* Pipeline Stage Steps */}
        <div className="space-y-4">
          {stages.map((stage, idx) => {
            const isCompleted = isFinished || (currentStageIndex > -1 && idx < currentStageIndex);
            const isCurrent = !isFinished && !isFailed && idx === currentStageIndex;

            return (
              <div key={stage.key} className="flex items-start space-x-3 text-xs">
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <div className="w-5 h-5 rounded-full bg-success text-white flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center">
                      <Clock className="w-3 h-3" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div
                    className={`font-medium ${
                      isCompleted ? 'text-text-primary' : isCurrent ? 'text-primary font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </div>
                  <div className="text-[11px] text-text-secondary mt-0.5">
                    {stage.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Failure Message */}
        {isFailed && (
          <div className="mt-6 p-4 rounded-lg bg-danger-light border border-danger-border text-danger text-xs space-y-2">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Pipeline terminated with an error
            </div>
            <div className="font-mono text-[11px] bg-white/70 p-2 rounded border border-danger-border">
              {job?.error_message || 'Unknown error occurred during processing.'}
            </div>
            <button
              onClick={() => repoId && api.reindexRepository(repoId).then((r) => navigate(`/app/repositories/${repoId}/indexing?jobId=${r.job_id}`))}
              className="mt-2 inline-flex items-center px-3 py-1.5 bg-danger text-white rounded text-xs font-medium hover:bg-red-700 transition-colors gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Retry Indexing
            </button>
          </div>
        )}

        {/* Ready Action */}
        {isFinished && (
          <div className="mt-8 pt-4 border-t border-border flex items-center justify-end">
            <Link
              to={`/app/repositories/${repoId}/overview`}
              className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-md shadow-sm transition-colors flex items-center gap-1.5"
            >
              View Repository Overview
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
