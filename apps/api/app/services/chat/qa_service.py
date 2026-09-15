import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from apps.api.app.models.repository import Snapshot, CodeChunk
from apps.api.app.models.chat import ChatThread, ChatMessage
from apps.api.app.providers.groq_client import groq_service
from apps.api.app.services.retrieval.fusion import HybridRetriever
from apps.api.app.services.retrieval.citation import CitationValidator
from apps.api.app.schemas.chat import Citation

logger = logging.getLogger(__name__)

class RawCitationItem(BaseModel):
    chunk_id: str = Field(..., description="The chunk ID or numeric index from context (e.g. chunk-1)")
    claim: Optional[str] = Field(None, description="Specific factual claim backed by this code snippet")

    @model_validator(mode="before")
    @classmethod
    def normalize_citation(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"chunk_id": data, "claim": None}
        return data

class RawQAResponse(BaseModel):
    answer: str = Field(..., description="Concise, direct answer to the developer's question")
    explanation: str = Field(default="", description="In-depth explanation referencing control flow, data models, or contracts")
    citations: List[RawCitationItem] = Field(default_factory=list, description="List of source code citations supporting key claims")
    uncertainties: List[str] = Field(default_factory=list, description="Clear statement of uncertainty when evidence is incomplete")
    suggested_questions: List[str] = Field(default_factory=list, description="2-3 relevant follow-up architecture or behavior questions")

class QAService:
    """
    Orchestrates repository question answering:
    Snapshot-scoped hybrid retrieval -> Groq generation -> Citation validation -> Persistence.
    """

    @classmethod
    async def answer_question(
        cls,
        session: AsyncSession,
        thread: ChatThread,
        user_query: str
    ) -> ChatMessage:
        # Retrieve candidate context chunks
        chunks = await HybridRetriever.retrieve_context(
            session=session,
            snapshot_id=thread.snapshot_id,
            query=user_query,
            top_k=8
        )

        context_text = []
        for idx, c in enumerate(chunks, start=1):
            context_text.append(
                f"[Source Chunk {idx} | ID: {c.id}]\n"
                f"File: {c.file_path}\n"
                f"Symbol: {c.symbol_name or 'N/A'}\n"
                f"Lines: {c.start_line}-{c.end_line}\n"
                f"Code:\n{c.original_code}\n"
            )
        joined_context = "\n---\n".join(context_text)

        # Retrieve recent conversation history
        hist_stmt = select(ChatMessage).where(ChatMessage.thread_id == thread.id).order_by(ChatMessage.created_at.desc()).limit(6)
        hist_res = await session.execute(hist_stmt)
        past_msgs = list(reversed(hist_res.scalars().all()))

        history_context = "\n".join([f"{m.role.capitalize()}: {m.content}" for m in past_msgs])

        prompt = f"""
Codebase Context:
{joined_context}

Previous Conversation:
{history_context}

Developer Question:
"{user_query}"

Instructions:
1. Provide a concise, direct answer followed by a relevant explanation.
2. Back your answer with exact source citations referencing the chunk IDs or index numbers (e.g. chunk-1, chunk-2).
3. If evidence is insufficient or logic is not in the provided snippets, explicitly state uncertainty and what is missing instead of guessing.
4. Suggest 2-3 logical follow-up questions to explore next.
"""

        # Save user message first
        user_msg = ChatMessage(
            thread_id=thread.id,
            role="user",
            content=user_query
        )
        session.add(user_msg)
        await session.commit()

        if not groq_service.is_configured():
            # Honest setup-required state when GROQ_API_KEY is not configured
            fallback_citations = [
                {
                    "chunk_id": c.id,
                    "file_path": c.file_path,
                    "symbol_name": c.symbol_name,
                    "start_line": c.start_line,
                    "end_line": c.end_line,
                    "snippet": c.original_code[:800],
                    "claim": f"Retrieved source matching '{user_query}'"
                }
                for c in chunks[:3]
            ]
            
            assistant_msg = ChatMessage(
                thread_id=thread.id,
                role="assistant",
                content=(
                    "**Groq API Key Required for Generative Answers**\n\n"
                    "The codebase ingestion, Sentence Transformers embeddings, Qdrant vector search, "
                    "and BM25 lexical retrieval have completed successfully and retrieved the relevant code snippets below. "
                    "To generate grounded natural language answers and explanations, please configure `GROQ_API_KEY` in `/app/settings`."
                ),
                citations=fallback_citations,
                uncertainties=["Groq generation is paused until an API key is provided."],
                suggested_questions=["Where is the token refresh handled?", "How are database connections initialized?"]
            )
            session.add(assistant_msg)
            await session.commit()
            return assistant_msg

        messages = [
            {
                "role": "system",
                "content": (
                    "You are CodeMentor, an expert software architecture assistant. "
                    "You answer questions about the codebase strictly grounded in the provided code snippets. "
                    "Never invent file paths, symbol names, or line numbers."
                )
            },
            {"role": "user", "content": prompt}
        ]

        try:
            qa_res = await groq_service.generate_structured(
                messages=messages,
                response_model=RawQAResponse,
                temperature=0.2
            )

            # Validate citations against stored records
            validated_citations = CitationValidator.validate_and_resolve(
                [c.model_dump() for c in qa_res.citations],
                available_chunks=chunks
            )

            assistant_content = f"{qa_res.answer}\n\n{qa_res.explanation}"

            assistant_msg = ChatMessage(
                thread_id=thread.id,
                role="assistant",
                content=assistant_content,
                citations=[c.model_dump() for c in validated_citations],
                uncertainties=qa_res.uncertainties,
                suggested_questions=qa_res.suggested_questions
            )
            session.add(assistant_msg)
            await session.commit()
            return assistant_msg

        except Exception as exc:
            logger.error("Error generating answer from Groq: %s", exc)
            err_msg = ChatMessage(
                thread_id=thread.id,
                role="assistant",
                content=f"An error occurred while generating the answer: {str(exc)}",
                citations=[
                    Citation(
                        chunk_id=c.id,
                        file_path=c.file_path,
                        symbol_name=c.symbol_name,
                        start_line=c.start_line,
                        end_line=c.end_line,
                        snippet=c.original_code[:800],
                        claim="Retrieved source context"
                    ).model_dump()
                    for c in chunks[:2]
                ],
                uncertainties=[str(exc)],
                suggested_questions=[]
            )
            session.add(err_msg)
            await session.commit()
            return err_msg
