from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class LearningPathCreate(BaseModel):
    goal: str = Field(..., min_length=5, description="Developer learning goal, e.g. Understand authentication in this project")
    experience_level: str = Field(..., description="beginner, intermediate, or advanced")
    topic: Optional[str] = Field(None, description="Optional focused topic or module")

class LessonReference(BaseModel):
    chunk_id: str
    file_path: str
    symbol_name: Optional[str] = None
    start_line: int
    end_line: int
    code_snippet: str

class LessonSummary(BaseModel):
    id: str
    path_id: str
    order_index: int
    title: str
    objective: str
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LessonDetail(BaseModel):
    id: str
    path_id: str
    order_index: int
    title: str
    objective: str
    why_it_matters: str
    explanation: str
    code_references: List[LessonReference] = []
    exercise_prompt: str
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LearningPathResponse(BaseModel):
    id: str
    repository_id: str
    snapshot_id: str
    goal: str
    experience_level: str
    topic: Optional[str] = None
    status: str
    lessons: List[LessonSummary] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ExerciseAttemptCreate(BaseModel):
    user_answer: str = Field(..., min_length=1, max_length=5000)

class ExerciseAttemptResponse(BaseModel):
    id: str
    lesson_id: str
    user_answer: str
    outcome: str  # correct, partial, incorrect, unable_to_assess
    feedback_what_understood: str
    feedback_what_missed: str
    explanation: str
    recommended_next_action: str
    remediation_question: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ProgressResponse(BaseModel):
    repository_id: str
    lessons_visited: List[str] = []
    topics_practiced: List[str] = []
    exercise_outcomes: Dict[str, int] = {}
    concepts_to_revisit: List[str] = []
    total_lessons: int = 0
    demonstrated_count: int = 0
    updated_at: datetime
