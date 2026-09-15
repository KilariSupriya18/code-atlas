import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from apps.api.app.database import get_db
from apps.api.app.models.repository import Repository
from apps.api.app.models.chat import ChatThread, ChatMessage
from apps.api.app.schemas.chat import (
    ThreadCreate, ThreadResponse, MessageCreate, MessageResponse, ThreadDetailResponse, Citation
)
from apps.api.app.services.chat.qa_service import QAService

router = APIRouter(tags=["Chat"])

@router.post("/api/repositories/{repo_id}/chat/threads", response_model=ThreadResponse)
async def create_thread(repo_id: str, payload: ThreadCreate, db: AsyncSession = Depends(get_db)):
    repo_stmt = select(Repository).where(Repository.id == repo_id)
    repo_res = await db.execute(repo_stmt)
    repo = repo_res.scalars().first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if not repo.current_snapshot_id:
        raise HTTPException(status_code=400, detail="Repository has no ready snapshot. Please index it first.")

    thread = ChatThread(
        repository_id=repo.id,
        snapshot_id=repo.current_snapshot_id,
        title=payload.title or "New Conversation"
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return ThreadResponse.model_validate(thread)

@router.get("/api/repositories/{repo_id}/chat/threads", response_model=List[ThreadResponse])
async def list_threads(repo_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(ChatThread).where(ChatThread.repository_id == repo_id).order_by(ChatThread.updated_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())

@router.get("/api/chat/threads/{thread_id}", response_model=ThreadDetailResponse)
async def get_thread(thread_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(ChatThread).where(ChatThread.id == thread_id)
    res = await db.execute(stmt)
    thread = res.scalars().first()
    if not thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")

    m_stmt = select(ChatMessage).where(ChatMessage.thread_id == thread_id).order_by(ChatMessage.created_at.asc())
    m_res = await db.execute(m_stmt)
    messages = m_res.scalars().all()

    formatted_messages = []
    for m in messages:
        cits = [Citation.model_validate(c) if isinstance(c, dict) else c for c in (m.citations or [])]
        formatted_messages.append(
            MessageResponse(
                id=m.id,
                thread_id=m.thread_id,
                role=m.role,
                content=m.content,
                citations=cits,
                uncertainties=m.uncertainties or [],
                suggested_questions=m.suggested_questions or [],
                created_at=m.created_at
            )
        )

    return ThreadDetailResponse(
        id=thread.id,
        repository_id=thread.repository_id,
        snapshot_id=thread.snapshot_id,
        title=thread.title,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        messages=formatted_messages
    )

@router.post("/api/chat/threads/{thread_id}/messages", response_model=MessageResponse)
async def send_message(thread_id: str, payload: MessageCreate, db: AsyncSession = Depends(get_db)):
    stmt = select(ChatThread).where(ChatThread.id == thread_id)
    res = await db.execute(stmt)
    thread = res.scalars().first()
    if not thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")

    # Update thread title on first message if default
    if thread.title == "New Conversation":
        thread.title = payload.content[:40] + ("..." if len(payload.content) > 40 else "")
        await db.commit()

    # Execute QA Service with hybrid retrieval and Groq generation
    assistant_msg = await QAService.answer_question(
        session=db,
        thread=thread,
        user_query=payload.content
    )

    cits = [Citation.model_validate(c) if isinstance(c, dict) else c for c in (assistant_msg.citations or [])]
    return MessageResponse(
        id=assistant_msg.id,
        thread_id=assistant_msg.thread_id,
        role=assistant_msg.role,
        content=assistant_msg.content,
        citations=cits,
        uncertainties=assistant_msg.uncertainties or [],
        suggested_questions=assistant_msg.suggested_questions or [],
        created_at=assistant_msg.created_at
    )
