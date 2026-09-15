import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCode,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { api, LessonReference, ExerciseAttempt } from '../api/client';
import { CodeViewer } from '../components/code/CodeViewer';

export const LessonPage: React.FC = () => {
  const { repoId, pathId, lessonId } = useParams<{ repoId: string; pathId: string; lessonId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [userAnswer, setUserAnswer] = useState('');
  const [activeRef, setActiveRef] = useState<LessonReference | null>(null);
  const [refFileContent, setRefFileContent] = useState<string | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<ExerciseAttempt | null>(null);

  // Restore draft response from localStorage
  useEffect(() => {
    if (lessonId) {
      const draft = localStorage.getItem(`draft_lesson_${lessonId}`);
      if (draft) setUserAnswer(draft);
    }
  }, [lessonId]);

  // Save draft on change
  const handleAnswerChange = (val: string) => {
    setUserAnswer(val);
    if (lessonId) {
      localStorage.setItem(`draft_lesson_${lessonId}`, val);
    }
  };

  // Fetch lesson detail
  const { data: lesson, isLoading } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => (lessonId ? api.getLesson(lessonId) : null),
    enabled: !!lessonId,
  });

  // Fetch learning path to get next/prev lesson links
  const { data: pathData } = useQuery({
    queryKey: ['learning-path', pathId],
    queryFn: () => (pathId ? api.getLearningPath(pathId) : null),
    enabled: !!pathId,
  });

  // Submit exercise attempt mutation
  const attemptMutation = useMutation({
    mutationFn: async (answerText: string) => {
      if (!lessonId) throw new Error('Missing lessonId');
      return api.submitAttempt(lessonId, answerText);
    },
    onSuccess: (attempt) => {
      setLatestAttempt(attempt);
      queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['learning-path', pathId] });
      queryClient.invalidateQueries({ queryKey: ['progress', repoId] });
      if (attempt.outcome === 'correct') {
        localStorage.removeItem(`draft_lesson_${lessonId}`);
      }
    },
  });

  const handleOpenRef = async (ref: LessonReference) => {
    if (!repoId) return;
    setActiveRef(ref);
    try {
      const src = await api.getSource(repoId, ref.file_path);
      setRefFileContent(src.content);
    } catch {
      setRefFileContent(ref.code_snippet);
    }
  };

  if (isLoading || !lesson) {
    return <div className="p-8 text-center text-xs text-text-secondary">Loading lesson...</div>;
  }

  // Find next lesson
  const currentIdx = pathData?.lessons?.findIndex((l) => l.id === lessonId) ?? -1;
  const nextLesson = currentIdx >= 0 && pathData?.lessons && currentIdx < pathData.lessons.length - 1
    ? pathData.lessons[currentIdx + 1]
    : null;
  const prevLesson = currentIdx > 0 && pathData?.lessons
    ? pathData.lessons[currentIdx - 1]
    : null;

  return (
    <div className="flex h-full overflow-hidden">
        {/* Lesson Content Column */}
        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10 lg:px-12 space-y-8 max-w-4xl mx-auto">
          {/* Navigation Breadcrumb */}
          <div className="flex items-center justify-between text-sm text-text-secondary pb-4 border-b border-border">
            <Link
              to={`/app/repositories/${repoId}/learn/${pathId}`}
              className="inline-flex items-center gap-1.5 font-medium text-text-secondary hover:text-text-primary transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              Back to Learning Path
            </Link>

            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-canvas border border-border text-text-secondary font-medium">
              Lesson {lesson.order_index} of {pathData?.lessons?.length ?? 1}
            </span>
          </div>

          {/* Lesson Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  lesson.status === 'demonstrated'
                    ? 'bg-teal-tint text-teal border-teal/30'
                    : lesson.status === 'practicing'
                    ? 'bg-amber-tint text-amber border-amber/30'
                    : 'bg-canvas text-text-secondary border-border'
                }`}
              >
                {lesson.status === 'demonstrated' ? 'Demonstrated' : lesson.status === 'practicing' ? 'Practicing' : 'Not Started'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight leading-tight">
              {lesson.title}
            </h1>

            <div className="p-4 rounded-xl bg-canvas border border-border">
              <div className="text-xs uppercase tracking-wider font-bold text-text-secondary mb-1">
                Learning Objective
              </div>
              <p className="text-base text-text-primary font-medium leading-relaxed">
                {lesson.objective}
              </p>
            </div>
          </div>

          {/* Why it Matters Card */}
          <div className="p-5 rounded-xl bg-indigo-tint/70 border-l-4 border-l-indigo border border-border text-text-primary space-y-1.5">
            <div className="font-bold text-indigo flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-indigo" />
              Why This Matters in Production
            </div>
            <p className="text-sm text-text-secondary leading-relaxed font-normal">
              {lesson.why_it_matters}
            </p>
          </div>

          {/* Technical Explanation */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-primary tracking-tight">
                Architecture & Implementation Details
              </h2>
            </div>
            <div className="prose-reading text-text-primary bg-surface border border-border rounded-xl p-6 sm:p-7 shadow-sm whitespace-pre-wrap font-normal">
              {lesson.explanation}
            </div>
          </div>

          {/* Read the Code References */}
          {lesson.code_references && lesson.code_references.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-text-primary tracking-tight">
                  Read the Code ({lesson.code_references.length})
                </h2>
                <span className="text-xs text-text-secondary">
                  Click to inspect live source side-by-side
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {lesson.code_references.map((ref, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOpenRef(ref)}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-surface hover:bg-canvas border border-border hover:border-indigo/50 text-text-primary transition-all text-left shadow-sm group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-tint text-indigo flex items-center justify-center shrink-0">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold text-text-primary truncate">
                          {ref.file_path}
                        </div>
                        {ref.symbol_name ? (
                          <div className="text-xs text-indigo font-mono truncate">
                            {ref.symbol_name}
                          </div>
                        ) : (
                          <div className="text-[11px] text-text-secondary">Module scope</div>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-text-secondary bg-canvas px-2 py-0.5 rounded border border-border shrink-0 ml-2">
                      L{ref.start_line}–{ref.end_line}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Check Understanding Exercise */}
          <div className="bg-canvas border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-tint text-indigo text-xs font-bold uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" />
                Check Your Understanding
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-text-primary leading-snug pt-1">
                {lesson.exercise_prompt}
              </h3>
              <p className="text-sm text-text-secondary">
                Explain conceptually in your own words. Your response is evaluated against hidden server-side rubrics and the real repository AST.
              </p>
            </div>

            <div className="space-y-2">
              <textarea
                rows={5}
                value={userAnswer}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Type your explanation here... Reference specific functions or architectural concepts when relevant."
                className="w-full p-4 text-sm bg-surface border border-border rounded-xl focus:outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20 font-mono text-text-primary placeholder:text-text-secondary/60 transition-all resize-y min-h-[130px]"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                  Draft saved in local browser storage
                </div>

                <button
                  onClick={() => {
                    handleAnswerChange(userAnswer);
                    attemptMutation.mutate(userAnswer);
                  }}
                  disabled={attemptMutation.isPending || !userAnswer.trim()}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo hover:bg-indigo-hover disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-2"
                >
                  {attemptMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Evaluating against rubric...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Answer
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Feedback Section */}
            {latestAttempt && (
              <div
                className={`mt-6 p-6 rounded-xl border space-y-4 animate-in fade-in duration-200 ${
                  latestAttempt.outcome === 'correct'
                    ? 'bg-teal-tint/50 border-teal/40 text-text-primary'
                    : 'bg-amber-tint/50 border-amber/40 text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    {latestAttempt.outcome === 'correct' ? (
                      <CheckCircle2 className="w-5 h-5 text-teal" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber" />
                    )}
                    <span className="font-bold text-base capitalize text-text-primary">
                      Evaluation Result: {latestAttempt.outcome}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      latestAttempt.outcome === 'correct'
                        ? 'bg-teal text-white'
                        : 'bg-amber text-white'
                    }`}
                  >
                    {latestAttempt.outcome === 'correct' ? 'Demonstrated' : 'Needs Practice'}
                  </span>
                </div>

                {latestAttempt.feedback_what_understood && (
                  <div className="p-4 rounded-lg bg-surface border border-border space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal block">
                      What was understood:
                    </span>
                    <p className="text-sm text-text-primary leading-relaxed">
                      {latestAttempt.feedback_what_understood}
                    </p>
                  </div>
                )}

                {latestAttempt.feedback_what_missed && (
                  <div className="p-4 rounded-lg bg-surface border border-border space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber block">
                      What was missed:
                    </span>
                    <p className="text-sm text-text-primary leading-relaxed">
                      {latestAttempt.feedback_what_missed}
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-surface border border-border space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-secondary block">
                    Source Grounding:
                  </span>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {latestAttempt.explanation}
                  </p>
                </div>

                {latestAttempt.remediation_question && (
                  <div className="p-4 bg-surface rounded-xl border-2 border-amber/50 space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber block">
                      Targeted Remediation Question:
                    </span>
                    <p className="text-sm font-medium text-text-primary">
                      {latestAttempt.remediation_question}
                    </p>
                  </div>
                )}

                {latestAttempt.recommended_next_action && (
                  <div className="text-xs font-semibold text-text-secondary pt-1 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo" />
                    Recommended next: {latestAttempt.recommended_next_action}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Lesson Navigation */}
          <div className="pt-6 pb-8 border-t border-border flex items-center justify-between">
            {prevLesson ? (
              <Link
                to={`/app/repositories/${repoId}/learn/${pathId}/lessons/${prevLesson.id}`}
                className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary bg-surface border border-border hover:border-slate-300 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous Lesson
              </Link>
            ) : <div />}

            {nextLesson ? (
              <Link
                to={`/app/repositories/${repoId}/learn/${pathId}/lessons/${nextLesson.id}`}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo hover:bg-indigo-hover rounded-lg shadow-sm transition-all inline-flex items-center gap-2"
              >
                Next Lesson
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to={`/app/repositories/${repoId}/progress`}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-teal hover:opacity-90 rounded-lg shadow-sm transition-all inline-flex items-center gap-2"
              >
                View Progress Report
                <CheckCircle2 className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Side Code Viewer Panel (40% width) */}
        {activeRef && (
          <div className="w-5/12 h-full shrink-0 border-l border-border bg-surface">
            <CodeViewer
              filePath={activeRef.file_path}
              symbolName={activeRef.symbol_name}
              startLine={activeRef.start_line}
              endLine={activeRef.end_line}
              content={refFileContent || activeRef.code_snippet}
              onClose={() => {
                setActiveRef(null);
                setRefFileContent(null);
              }}
            />
          </div>
        )}
      </div>
  );
};
