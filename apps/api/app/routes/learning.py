import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from apps.api.app.database import get_db
from apps.api.app.models.repository import Repository
from apps.api.app.models.learning import LearningPath, Lesson, ExerciseAttempt
from apps.api.app.schemas.learning import (
    LearningPathCreate, LearningPathResponse, LessonSummary, LessonDetail,
    ExerciseAttemptCreate, ExerciseAttemptResponse, LessonReference
)
from apps.api.app.services.learning.planner import LearningPlanner
from apps.api.app.services.learning.evaluator import ExerciseEvaluator

router = APIRouter(tags=["Adaptive Learning"])

@router.post("/api/repositories/{repo_id}/learning-paths", response_model=LearningPathResponse)
async def create_learning_path(repo_id: str, payload: LearningPathCreate, db: AsyncSession = Depends(get_db)):
    repo_stmt = select(Repository).where(Repository.id == repo_id)
    repo_res = await db.execute(repo_stmt)
    repo = repo_res.scalars().first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if not repo.current_snapshot_id:
        raise HTTPException(status_code=400, detail="Repository has no ready snapshot. Index the codebase first.")

    path_id = str(uuid.uuid4())
    learning_path = LearningPath(
        id=path_id,
        repository_id=repo.id,
        snapshot_id=repo.current_snapshot_id,
        goal=payload.goal,
        experience_level=payload.experience_level,
        topic=payload.topic,
        status="active"
    )
    db.add(learning_path)
    await db.commit()

    # Plan lessons grounded in retrieved source code
    planned_lessons = await LearningPlanner.create_path(
        session=db,
        snapshot_id=repo.current_snapshot_id,
        goal=payload.goal,
        experience_level=payload.experience_level,
        topic=payload.topic or ""
    )

    lessons_created = []
    for idx, item in enumerate(planned_lessons, start=1):
        lesson_id = str(uuid.uuid4())
        lesson = Lesson(
            id=lesson_id,
            path_id=path_id,
            order_index=idx,
            title=item["title"],
            objective=item["objective"],
            why_it_matters=item["why_it_matters"],
            explanation=item["explanation"],
            code_references=item["code_references"],
            exercise_prompt=item["exercise_prompt"],
            rubric=item["rubric"],  # Hidden server-side
            status="not_started"
        )
        lessons_created.append(lesson)
        db.add(lesson)

    await db.commit()

    created_lesson_summaries = [LessonSummary.model_validate(l) for l in lessons_created]

    return LearningPathResponse(
        id=learning_path.id,
        repository_id=learning_path.repository_id,
        snapshot_id=learning_path.snapshot_id,
        goal=learning_path.goal,
        experience_level=learning_path.experience_level,
        topic=learning_path.topic,
        status=learning_path.status,
        lessons=created_lesson_summaries,
        created_at=learning_path.created_at
    )

@router.get("/api/repositories/{repo_id}/learning-paths", response_model=List[LearningPathResponse])
async def list_learning_paths(repo_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(LearningPath).where(LearningPath.repository_id == repo_id).order_by(LearningPath.created_at.desc())
    res = await db.execute(stmt)
    paths = res.scalars().all()

    output = []
    for p in paths:
        l_stmt = select(Lesson).where(Lesson.path_id == p.id).order_by(Lesson.order_index.asc())
        l_res = await db.execute(l_stmt)
        lessons = l_res.scalars().all()
        output.append(
            LearningPathResponse(
                id=p.id,
                repository_id=p.repository_id,
                snapshot_id=p.snapshot_id,
                goal=p.goal,
                experience_level=p.experience_level,
                topic=p.topic,
                status=p.status,
                lessons=[LessonSummary.model_validate(l) for l in lessons],
                created_at=p.created_at
            )
        )
    return output

@router.get("/api/learning-paths/{path_id}", response_model=LearningPathResponse)
async def get_learning_path(path_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(LearningPath).where(LearningPath.id == path_id)
    res = await db.execute(stmt)
    path = res.scalars().first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")

    l_stmt = select(Lesson).where(Lesson.path_id == path_id).order_by(Lesson.order_index.asc())
    l_res = await db.execute(l_stmt)
    lessons = l_res.scalars().all()

    return LearningPathResponse(
        id=path.id,
        repository_id=path.repository_id,
        snapshot_id=path.snapshot_id,
        goal=path.goal,
        experience_level=path.experience_level,
        topic=path.topic,
        status=path.status,
        lessons=[LessonSummary.model_validate(l) for l in lessons],
        created_at=path.created_at
    )

@router.get("/api/lessons/{lesson_id}", response_model=LessonDetail)
async def get_lesson(lesson_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Lesson).where(Lesson.id == lesson_id)
    res = await db.execute(stmt)
    lesson = res.scalars().first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Format code references safely
    refs = [
        LessonReference.model_validate(r) if isinstance(r, dict) else r
        for r in (lesson.code_references or [])
    ]

    return LessonDetail(
        id=lesson.id,
        path_id=lesson.path_id,
        order_index=lesson.order_index,
        title=lesson.title,
        objective=lesson.objective,
        why_it_matters=lesson.why_it_matters,
        explanation=lesson.explanation,
        code_references=refs,
        exercise_prompt=lesson.exercise_prompt,
        status=lesson.status,
        created_at=lesson.created_at
    )

@router.post("/api/lessons/{lesson_id}/attempts", response_model=ExerciseAttemptResponse)
async def submit_exercise_attempt(
    lesson_id: str,
    payload: ExerciseAttemptCreate,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Lesson).where(Lesson.id == lesson_id)
    res = await db.execute(stmt)
    lesson = res.scalars().first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Get repository id
    p_stmt = select(LearningPath).where(LearningPath.id == lesson.path_id)
    p_res = await db.execute(p_stmt)
    path = p_res.scalars().first()
    repo_id = path.repository_id if path else "unknown"

    # Evaluate against hidden rubric
    evaluation = await ExerciseEvaluator.evaluate_submission(
        session=db,
        lesson=lesson,
        repo_id=repo_id,
        user_answer=payload.user_answer
    )

    # Persist attempt and update progress
    attempt = await ExerciseEvaluator.record_attempt_and_update_progress(
        session=db,
        lesson=lesson,
        repo_id=repo_id,
        user_answer=payload.user_answer,
        evaluation=evaluation
    )

    return ExerciseAttemptResponse(
        id=attempt.id,
        lesson_id=attempt.lesson_id,
        user_answer=attempt.user_answer,
        outcome=attempt.outcome,
        feedback_what_understood=attempt.feedback_what_understood,
        feedback_what_missed=attempt.feedback_what_missed,
        explanation=attempt.explanation,
        recommended_next_action=attempt.recommended_next_action,
        remediation_question=evaluation.get("remediation_question"),
        created_at=attempt.created_at
    )
