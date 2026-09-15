import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap,
  Sparkles,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  BookOpen,
  Loader2,
  Target,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { api, LearningPath } from '../api/client';

export const LearnPathPage: React.FC = () => {
  const { repoId, pathId } = useParams<{ repoId: string; pathId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [goal, setGoal] = useState('I know Python and need to understand authentication and payment failures in this project.');
  const [experienceLevel, setExperienceLevel] = useState('intermediate');
  const [topic, setTopic] = useState('Authentication & Payment Service');
  const [showForm, setShowForm] = useState(false);

  // Fetch learning paths
  const { data: paths, isLoading } = useQuery({
    queryKey: ['learning-paths', repoId],
    queryFn: () => (repoId ? api.listLearningPaths(repoId) : []),
    enabled: !!repoId,
  });

  // Selected path detail
  const activePathId = pathId || (paths && paths.length > 0 ? paths[0].id : null);
  const { data: selectedPath } = useQuery({
    queryKey: ['learning-path', activePathId],
    queryFn: () => (activePathId ? api.getLearningPath(activePathId) : null),
    enabled: !!activePathId,
  });

  // Create path mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!repoId) throw new Error('Missing repoId');
      return api.createLearningPath(repoId, goal, experienceLevel, topic);
    },
    onSuccess: (newPath) => {
      queryClient.invalidateQueries({ queryKey: ['learning-paths', repoId] });
      setShowForm(false);
      navigate(`/app/repositories/${repoId}/learn/${newPath.id}`);
    },
  });

  // Find the next available uncompleted lesson for primary action
  const nextLesson = selectedPath?.lessons?.find((l) => l.status !== 'demonstrated') || selectedPath?.lessons?.[0];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="text-[12px] font-bold uppercase tracking-wider text-text-secondary">
            ONBOARDING CURRICULUM
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
            Learn this codebase
          </h1>
          <p className="text-[16px] text-text-secondary leading-relaxed max-w-2xl">
            Choose a goal. Follow the code. Check your understanding.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="h-11 px-4 text-[15px] font-medium text-white bg-teal hover:bg-teal-hover rounded-xl shadow-xs transition-colors flex items-center gap-2 self-start shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Learning Goal</span>
        </button>
      </div>

      {/* 2. Goal Creator Collapsible Form */}
      {showForm && (
        <div className="bg-surface border border-teal-border rounded-2xl p-7 shadow-xs space-y-5">
          <div>
            <h2 className="text-[20px] font-bold text-text-primary tracking-tight">
              Define Your Onboarding Goal
            </h2>
            <p className="text-[15px] text-text-secondary mt-1">
              CodeAtlas will retrieve relevant architecture modules and synthesize progressive lessons with evaluation rubrics.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-5"
          >
            <div>
              <label className="block text-[14px] font-semibold text-text-primary mb-1.5">
                What do you want to learn or achieve?
              </label>
              <textarea
                rows={3}
                required
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., I know Python and need to understand authentication and payment failures in this project."
                className="w-full p-3.5 text-[15px] bg-canvas border border-border rounded-xl focus:bg-white focus:outline-none focus:border-teal text-text-primary shadow-2xs leading-relaxed"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[14px] font-semibold text-text-primary mb-1.5">
                  Your Experience Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full h-11 px-3 text-[14px] bg-canvas border border-border rounded-xl focus:bg-white focus:outline-none focus:border-teal text-text-primary"
                >
                  <option value="beginner">Beginner (Need step-by-step guidance)</option>
                  <option value="intermediate">Intermediate (Familiar with Python / architecture)</option>
                  <option value="advanced">Advanced (Deep dive into contracts & edge cases)</option>
                </select>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-text-primary mb-1.5">
                  Topic Focus (Optional)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Auth & Error Handling"
                  className="w-full h-11 px-3 text-[14px] bg-canvas border border-border rounded-xl focus:bg-white focus:outline-none focus:border-teal text-text-primary"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-11 px-4 text-[14px] font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !goal.trim()}
                className="h-11 px-5 text-[15px] font-medium text-white bg-teal hover:bg-teal-hover disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Curriculum with Groq...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Learning Path</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Balanced 30/70 Two-Column Layout */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left: Learning Path Selection (around 30% = 4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[13px] font-bold text-text-secondary uppercase tracking-wider">
              Learning Paths ({paths?.length ?? 0})
            </h3>
          </div>

          {isLoading ? (
            <div className="text-[15px] text-text-secondary py-4">Loading learning paths...</div>
          ) : !paths || paths.length === 0 ? (
            <div className="p-6 bg-surface border border-border rounded-2xl text-[14px] text-text-secondary space-y-3 shadow-xs">
              <p>No learning paths created yet.</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-[14px] font-medium text-teal hover:underline flex items-center gap-1"
              >
                <span>Define your first goal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {paths.map((p) => {
                const isSelected = p.id === activePathId;
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/app/repositories/${repoId}/learn/${p.id}`)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-teal-tint/60 border-l-4 border-l-teal border-teal-border shadow-xs'
                        : 'bg-surface border-border hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[13px] text-text-secondary mb-2">
                      <span className="capitalize font-semibold text-teal bg-teal-tint px-2 py-0.5 rounded-md border border-teal-border/60">
                        {p.experience_level}
                      </span>
                      <span className="text-[12px]">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>

                    <h4 className="text-[16px] font-bold text-text-primary line-clamp-2 leading-snug">
                      {p.goal}
                    </h4>

                    <div className="mt-3 flex items-center text-[13px] text-text-secondary gap-1.5 font-medium">
                      <BookOpen className="w-4 h-4 text-teal" />
                      <span>{p.lessons.length} lessons in journey</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Path & Ordered Journey (around 70% = 8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedPath ? (
            <div className="bg-surface border border-border rounded-2xl p-7 sm:p-8 shadow-xs space-y-8">
              {/* Active Plan Header */}
              <div className="space-y-3 pb-6 border-b border-border">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center space-x-1.5 text-[13px] text-teal bg-teal-tint px-3 py-1 rounded-full font-semibold border border-teal-border/70">
                    <Target className="w-3.5 h-3.5" />
                    <span>Active Onboarding Curriculum</span>
                  </div>

                  {nextLesson && (
                    <Link
                      to={`/app/repositories/${repoId}/learn/${selectedPath.id}/lessons/${nextLesson.id}`}
                      className="h-10 px-4 text-[14px] font-medium text-white bg-teal hover:bg-teal-hover rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <span>{nextLesson.status === 'demonstrated' ? 'Review Lesson' : `Continue Lesson ${nextLesson.order_index}`}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                  {selectedPath.goal}
                </h2>

                {selectedPath.topic && (
                  <p className="text-[15px] text-text-secondary">
                    <span className="font-semibold text-text-primary">Focus:</span> {selectedPath.topic}
                  </p>
                )}
              </div>

              {/* Ordered Lesson Steps (Code-path journey motif) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-text-secondary uppercase tracking-wider">
                    Learning Journey Steps
                  </h3>
                  <span className="text-[13px] text-text-secondary">
                    {selectedPath.lessons.filter(l => l.status === 'demonstrated').length} of {selectedPath.lessons.length} demonstrated
                  </span>
                </div>

                <div className="relative pl-6 space-y-6">
                  {/* Subtle vertical connecting line */}
                  <div className="code-path-line" />

                  {selectedPath.lessons.map((lesson, idx) => {
                    const isDemonstrated = lesson.status === 'demonstrated';
                    const isPracticing = lesson.status === 'practicing';
                    const isNext = lesson.id === nextLesson?.id;

                    return (
                      <div
                        key={lesson.id}
                        className={`relative code-path-step p-5 rounded-2xl border transition-all ${
                          isNext
                            ? 'bg-teal-tint/40 border-teal-border shadow-xs'
                            : 'bg-canvas/50 border-border/80 hover:bg-canvas hover:border-slate-300'
                        }`}
                      >
                        {/* Step Marker on the connecting line */}
                        <div className="absolute -left-6 top-6 -translate-x-1/2">
                          {isDemonstrated ? (
                            <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center shadow-xs">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                          ) : isPracticing ? (
                            <div className="w-8 h-8 rounded-full bg-amber text-white flex items-center justify-center font-bold text-[12px] shadow-xs">
                              P
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white text-text-secondary border-2 border-border flex items-center justify-center font-bold text-[13px] shadow-2xs">
                              {idx + 1}
                            </div>
                          )}
                        </div>

                        {/* Step Content */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-[12px] font-mono text-text-secondary font-semibold">
                                STEP {idx + 1}
                              </span>
                              {isDemonstrated && (
                                <span className="text-[11px] font-semibold text-teal bg-teal-tint px-2 py-0.5 rounded-full border border-teal-border/70">
                                  Demonstrated
                                </span>
                              )}
                              {isPracticing && (
                                <span className="text-[11px] font-semibold text-amber bg-amber-tint px-2 py-0.5 rounded-full border border-amber-border">
                                  Practicing
                                </span>
                              )}
                            </div>

                            <h4 className="text-[18px] sm:text-[19px] font-bold text-text-primary tracking-tight leading-snug">
                              {lesson.title}
                            </h4>

                            <p className="text-[15px] text-text-secondary leading-relaxed">
                              {lesson.objective}
                            </p>
                          </div>

                          <Link
                            to={`/app/repositories/${repoId}/learn/${selectedPath.id}/lessons/${lesson.id}`}
                            className={`shrink-0 h-10 px-4 text-[14px] font-medium rounded-xl transition-colors flex items-center gap-1.5 self-start sm:self-center ${
                              isNext
                                ? 'bg-teal text-white hover:bg-teal-hover shadow-xs'
                                : 'bg-surface border border-border text-text-primary hover:bg-slate-100'
                            }`}
                          >
                            <span>{isDemonstrated ? 'Review' : isPracticing ? 'Resume' : 'Start'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-14 text-center text-[16px] text-text-secondary shadow-xs">
              Select or generate a learning path from the left to begin your onboarding.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
