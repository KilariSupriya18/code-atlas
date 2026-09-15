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
  const visitedCount = progress?.lessons_visited?.length ?? 0;

  const hasActivity = totalSubmissions > 0 || visitedCount > 0;

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-text-secondary mb-1">
            ACCOUNTABILITY & KNOWLEDGE RETENTION
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Learning Progress
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Real evaluation metrics, demonstrated competencies, and concepts to revisit.
          </p>
        </div>

        <Link
          to={`/app/repositories/${repoId}/learn`}
          className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo hover:bg-indigo-hover rounded-lg shadow-sm transition-all inline-flex items-center gap-2 self-start"
        >
          <GraduationCap className="w-4 h-4" />
          {hasActivity ? 'Continue Learning' : 'Start Learning'}
        </Link>
      </div>

      {!hasActivity ? (
        /* Single Intentional Empty State */
        <div className="bg-surface border border-border rounded-2xl p-10 sm:p-14 text-center max-w-2xl mx-auto space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-tint text-indigo flex items-center justify-center mx-auto border border-indigo/20">
            <GraduationCap className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
              Your learning journey starts here
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
              Complete an exercise in any lesson to see what you understand and what to revisit. As you submit responses, CodeAtlas evaluates them against hidden rubrics and builds your competency profile.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to={`/app/repositories/${repoId}/learn`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo hover:bg-indigo-hover rounded-lg shadow-sm transition-all"
            >
              Start Learning Path
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        /* Active Progress State */
        <div className="space-y-8">
          {/* Metric Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wider font-bold text-text-secondary">
                Lessons Visited
              </div>
              <div className="text-3xl font-extrabold font-mono text-text-primary mt-2">
                {visitedCount}
              </div>
              <div className="text-xs text-text-secondary mt-1">Unique modules opened</div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wider font-bold text-teal">
                Correct Answers
              </div>
              <div className="text-3xl font-extrabold font-mono text-teal mt-2">
                {correctCount}
              </div>
              <div className="text-xs text-text-secondary mt-1">Rubric criteria demonstrated</div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wider font-bold text-amber">
                Practicing / Review
              </div>
              <div className="text-3xl font-extrabold font-mono text-amber mt-2">
                {partialCount + incorrectCount}
              </div>
              <div className="text-xs text-text-secondary mt-1">Partial or needs review</div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wider font-bold text-text-secondary">
                Total Attempts
              </div>
              <div className="text-3xl font-extrabold font-mono text-text-primary mt-2">
                {totalSubmissions}
              </div>
              <div className="text-xs text-text-secondary mt-1">Evaluated responses</div>
            </div>
          </div>

          {/* Two-Column Area: Concepts to Revisit vs Topics Practiced */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column: Concepts to Revisit */}
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber" />
                  <h3 className="text-base font-bold text-text-primary">
                    Concepts to Revisit
                  </h3>
                </div>
                <span className="text-xs font-mono text-text-secondary bg-canvas px-2 py-0.5 rounded border border-border">
                  {progress?.concepts_to_revisit?.length ?? 0}
                </span>
              </div>

              {!progress?.concepts_to_revisit || progress.concepts_to_revisit.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-teal mx-auto" />
                  <p className="text-sm font-semibold text-text-primary">
                    No active knowledge gaps
                  </p>
                  <p className="text-xs text-text-secondary max-w-xs mx-auto">
                    All completed exercises currently satisfy understanding rubrics.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {progress.concepts_to_revisit.map((gap, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-amber-tint/60 border border-amber/30 rounded-lg text-sm text-text-primary flex items-start gap-2.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber mt-2 shrink-0"></span>
                      <span className="leading-relaxed">{gap}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Topics Practiced */}
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal" />
                  <h3 className="text-base font-bold text-text-primary">
                    Topics Practiced
                  </h3>
                </div>
                <span className="text-xs font-mono text-text-secondary bg-canvas px-2 py-0.5 rounded border border-border">
                  {progress?.topics_practiced?.length ?? 0}
                </span>
              </div>

              {!progress?.topics_practiced || progress.topics_practiced.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-secondary">
                  Topics will appear here as you submit exercise explanations.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {progress.topics_practiced.map((topic, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-canvas hover:bg-slate-100 text-text-primary text-xs font-medium rounded-lg border border-border transition-colors"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
