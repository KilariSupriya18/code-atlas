import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from apps.api.app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_id = Column(String(36), nullable=False)
    goal = Column(Text, nullable=False)
    experience_level = Column(String(64), nullable=False)  # beginner, intermediate, advanced
    topic = Column(String(255), nullable=True)
    status = Column(String(32), default="active")  # active, completed
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("Repository", back_populates="learning_paths")
    lessons = relationship("Lesson", back_populates="path", cascade="all, delete-orphan", order_by="Lesson.order_index")

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    path_id = Column(String(36), ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False, index=True)
    order_index = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    objective = Column(Text, nullable=False)
    why_it_matters = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    code_references = Column(JSON, default=list)  # list of chunk citations
    exercise_prompt = Column(Text, nullable=False)
    rubric = Column(JSON, default=dict)  # HIDDEN server-side evaluation criteria
    status = Column(String(32), default="not_started")  # not_started, practicing, demonstrated
    created_at = Column(DateTime, default=datetime.utcnow)

    path = relationship("LearningPath", back_populates="lessons")
    attempts = relationship("ExerciseAttempt", back_populates="lesson", cascade="all, delete-orphan", order_by="ExerciseAttempt.created_at")

class ExerciseAttempt(Base):
    __tablename__ = "exercise_attempts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    lesson_id = Column(String(36), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    user_answer = Column(Text, nullable=False)
    outcome = Column(String(32), nullable=False)  # correct, partial, incorrect, unable_to_assess
    feedback_what_understood = Column(Text, nullable=False)
    feedback_what_missed = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    recommended_next_action = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lesson = relationship("Lesson", back_populates="attempts")

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    lessons_visited = Column(JSON, default=list)  # list of lesson_ids
    topics_practiced = Column(JSON, default=list)  # list of topics
    exercise_outcomes = Column(JSON, default=dict)  # { "correct": count, "partial": count, "incorrect": count }
    concepts_to_revisit = Column(JSON, default=list)  # list of concept strings
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
