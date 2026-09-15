import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { api } from '../api/client';

export const ProgressPage: React.FC = () => {
  const { repoId } = useParams<{ repoId: string }>();

  const { data: progress, isLoading } = useQuery({
    queryKey: ['progress', repoId],
    queryFn: () => (repoId ? api.getProgress(repoId) : null),
    enabled: !!repoId,
  });

  const { data: paths } = useQuery({
    queryKey: ['learning-paths', repoId],
    queryFn: () => (repoId ? api.listLearningPaths(repoId) : []),
    enabled: !!repoId,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-text-secondary">Loading progress data...</div>;
  }

  const outcomes = progress?.exercise_outcomes || {};
  const correctCount = outcomes['correct'] || 0;
  const partialCount = outcomes['partial'] || 0;
  const incorrectCount = outcomes['incorrect'] || 0;
  const totalSubmissions = correctCount + partialCount + incorrectCount;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Learning & Onboarding Progress
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Real evaluation metrics, demonstrated competencies, and concepts to revisit.
          </p>
        </div>

        <Link
          to={`/app/repositories/${repoId}/learn`}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-md shadow-sm transition-colors flex items-center gap-1.5 self-start"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Continue Learning
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[11px] text-text-secondary">Lessons Visited</div>
          <div className="text-xl font-bold font-mono text-text-primary mt-1">
            {progress?.lessons_visited?.length ?? 0}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[11px] text-text-secondary">Demonstrated Mastery</div>
          <div className="text-xl font-bold font-mono text-success mt-1">
            {correctCount}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[11px] text-text-secondary">Practicing / Partial</div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1">
            {partialCount}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[11px] text-text-secondary">Total Submissions</div>
          <div className="text-xl font-bold font-mono text-text-primary mt-1">
            {totalSubmissions}
          </div>
        </div>
      </div>

      {/* Concepts to Revisit */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Concepts to Revisit
          </h3>
          <span className="text-[11px] text-text-secondary">
            Auto-populated from incomplete submissions
          </span>
        </div>

        {!progress?.concepts_to_revisit || progress.concepts_to_revisit.length === 0 ? (
          <div className="py-4 text-xs text-text-secondary text-center">
            No knowledge gaps detected yet. Great job!
          </div>
        ) : (
          <div className="space-y-2">
            {progress.concepts_to_revisit.map((gap, idx) => (
              <div
                key={idx}
                className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-xs text-text-primary"
              >
                {gap}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Topics Practiced */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-border">
          Topics Practiced
        </h3>

        {!progress?.topics_practiced || progress.topics_practiced.length === 0 ? (
          <div className="py-4 text-xs text-text-secondary text-center">
            No topics completed yet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {progress.topics_practiced.map((topic, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-slate-100 text-text-primary text-xs font-medium rounded-md border border-slate-200"
              >
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
