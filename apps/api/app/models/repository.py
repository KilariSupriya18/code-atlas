import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from apps.api.app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False, unique=True, index=True)
    url = Column(String(512), nullable=False)
    default_branch = Column(String(128), default="main")
    current_snapshot_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    snapshots = relationship("Snapshot", back_populates="repository", cascade="all, delete-orphan")
    jobs = relationship("IndexJob", back_populates="repository", cascade="all, delete-orphan")
    chat_threads = relationship("ChatThread", back_populates="repository", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath", back_populates="repository", cascade="all, delete-orphan")

class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    commit_sha = Column(String(40), nullable=False)
    branch = Column(String(128), default="main")
    status = Column(String(32), default="pending")  # pending, ready, failed
    file_count = Column(Integer, default=0)
    symbol_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    embedding_model = Column(String(128), nullable=False)
    vector_dim = Column(Integer, default=384)
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("Repository", back_populates="snapshots")
    files = relationship("SourceFile", back_populates="snapshot", cascade="all, delete-orphan")
    chunks = relationship("CodeChunk", back_populates="snapshot", cascade="all, delete-orphan")

class SourceFile(Base):
    __tablename__ = "source_files"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    snapshot_id = Column(String(36), ForeignKey("snapshots.id", ondelete="CASCADE"), nullable=False, index=True)
    path = Column(String(512), nullable=False)
    language = Column(String(64), nullable=False)
    content = Column(Text, nullable=False)
    size = Column(Integer, default=0)
    commit_sha = Column(String(40), nullable=False)
    content_hash = Column(String(64), nullable=False)

    snapshot = relationship("Snapshot", back_populates="files")
    chunks = relationship("CodeChunk", back_populates="file", cascade="all, delete-orphan")

class CodeChunk(Base):
    __tablename__ = "code_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    snapshot_id = Column(String(36), ForeignKey("snapshots.id", ondelete="CASCADE"), nullable=False, index=True)
    file_id = Column(String(36), ForeignKey("source_files.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(512), nullable=False, index=True)
    language = Column(String(64), nullable=False)
    chunk_type = Column(String(64), nullable=False)  # function, async_function, method, class, module_code, readme, config
    symbol_name = Column(String(255), nullable=True, index=True)
    parent_symbol = Column(String(255), nullable=True)
    signature = Column(Text, nullable=True)
    docstring = Column(Text, nullable=True)
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    original_code = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False)
    qdrant_point_id = Column(String(64), nullable=False, index=True)

    snapshot = relationship("Snapshot", back_populates="chunks")
    file = relationship("SourceFile", back_populates="chunks")

class IndexJob(Base):
    __tablename__ = "index_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_id = Column(String(36), nullable=False)
    stage = Column(String(32), default="queued")  # queued, fetching, parsing, embedding, finalizing, ready, failed
    progress_stats = Column(JSON, default=dict)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository = relationship("Repository", back_populates="jobs")
