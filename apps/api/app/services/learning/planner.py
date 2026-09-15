import json
import logging
from typing import List, Dict, Any
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.models.repository import CodeChunk
from apps.api.app.providers.groq_client import groq_service
from apps.api.app.services.retrieval.fusion import HybridRetriever

logger = logging.getLogger(__name__)

class RawLessonPlan(BaseModel):
    title: str = Field(default="", description="Concise lesson title")
    objective: str = Field(default="", description="Specific technical learning outcome")
    why_it_matters: str = Field(default="", description="Why this architecture/code matters in production")
    explanation: str = Field(default="", description="Detailed explanation of inputs, conditions, outputs, and dependencies")
    chunk_index_refs: List[int] = Field(default_factory=list, description="1-indexed references to provided context chunks")
    exercise_prompt: str = Field(default="", description="One repository-specific short-answer question checking understanding")
    rubric_required_concepts: List[str] = Field(default_factory=list, description="Hidden server-side required concepts")
    rubric_acceptable_alternatives: List[str] = Field(default_factory=list, description="Acceptable alternative phrasings")
    rubric_common_misconceptions: List[str] = Field(default_factory=list, description="Common novice errors or misconceptions")

    @model_validator(mode="before")
    @classmethod
    def normalize_lesson(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)
        
        # title
        if not d.get("title"):
            d["title"] = d.get("lesson_title") or d.get("name") or f"Lesson {d.get('lesson_number', 1)}"
            
        # objective
        if not d.get("objective"):
            d["objective"] = d.get("goal") or d.get("learning_objective") or d.get("learning_outcome") or d.get("description") or f"Master the concepts in {d.get('title', 'this module')}"
            
        # why_it_matters
        if not d.get("why_it_matters"):
            d["why_it_matters"] = d.get("importance") or d.get("rationale") or d.get("production_impact") or "Understanding this architecture is critical for writing robust code."
            
        # explanation
        if not d.get("explanation"):
            d["explanation"] = d.get("content") or d.get("details") or d.get("overview") or d.get("summary") or d.get("objective") or ""
            
        # exercise_prompt
        if not d.get("exercise_prompt"):
            ex = d.get("exercise") or d.get("practice") or d.get("question") or d.get("task")
            if isinstance(ex, dict):
                d["exercise_prompt"] = ex.get("prompt") or ex.get("question") or ex.get("description") or str(ex)
            elif isinstance(ex, str):
                d["exercise_prompt"] = ex
            else:
                d["exercise_prompt"] = "Explain the key control flow, validation steps, and error handling in this module."
                
        # rubric fields (might be nested under 'rubric' object or flat)
        rubric = d.get("rubric")
        if isinstance(rubric, dict):
            if not d.get("rubric_required_concepts"):
                d["rubric_required_concepts"] = rubric.get("required_concepts") or rubric.get("concepts") or rubric.get("key_concepts") or []
            if not d.get("rubric_acceptable_alternatives"):
                d["rubric_acceptable_alternatives"] = rubric.get("acceptable_alternatives") or rubric.get("alternatives") or []
            if not d.get("rubric_common_misconceptions"):
                d["rubric_common_misconceptions"] = rubric.get("common_misconceptions") or rubric.get("misconceptions") or []
                
        if not d.get("rubric_required_concepts"):
            req = d.get("required_concepts") or d.get("concepts") or []
            if isinstance(req, list):
                d["rubric_required_concepts"] = req
            elif isinstance(req, str):
                d["rubric_required_concepts"] = [req]
            else:
                d["rubric_required_concepts"] = ["control flow", "error handling", "state validation"]
                
        if not isinstance(d.get("rubric_acceptable_alternatives"), list):
            d["rubric_acceptable_alternatives"] = []
        if not isinstance(d.get("rubric_common_misconceptions"), list):
            d["rubric_common_misconceptions"] = []
            
        # chunk_index_refs
        refs = d.get("chunk_index_refs") or d.get("chunk_refs") or d.get("chunks") or d.get("source_chunks") or [1]
        if isinstance(refs, list):
            parsed_refs = []
            for r in refs:
                if isinstance(r, int):
                    parsed_refs.append(r)
                elif isinstance(r, str):
                    import re
                    nums = re.findall(r"\d+", r)
                    if nums:
                        parsed_refs.append(int(nums[0]))
            d["chunk_index_refs"] = parsed_refs or [1]
        else:
            d["chunk_index_refs"] = [1]
            
        return d

class RawPathPlan(BaseModel):
    lessons: List[RawLessonPlan] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_path(cls, data: Any) -> Any:
        if isinstance(data, list):
            return {"lessons": data}
        if not isinstance(data, dict):
            return {"lessons": []}
        d = dict(data)
        if "lessons" in d and isinstance(d["lessons"], list):
            return d
        for candidate_key in ["curriculum", "path", "plan", "modules", "steps", "learning_path"]:
            if candidate_key in d and isinstance(d[candidate_key], list):
                d["lessons"] = d[candidate_key]
                return d
        return d

class LearningPlanner:
    """
    Generates tailored, source-grounded learning paths with hidden rubrics
    based on developer goal and experience level.
    """

    @classmethod
    async def create_path(
        cls,
        session: AsyncSession,
        snapshot_id: str,
        goal: str,
        experience_level: str,
        topic: str = ""
    ) -> List[Dict[str, Any]]:
        # Retrieve rich context for the learning goal
        search_query = f"{goal} {topic}".strip()
        chunks = await HybridRetriever.retrieve_context(
            session=session,
            snapshot_id=snapshot_id,
            query=search_query,
            top_k=8
        )

        context_blocks = []
        for idx, c in enumerate(chunks, start=1):
            context_blocks.append(
                f"[Source Chunk {idx}]\n"
                f"File: {c.file_path}\n"
                f"Symbol: {c.symbol_name or 'N/A'}\n"
                f"Lines: {c.start_line}-{c.end_line}\n"
                f"Code:\n{c.original_code}\n"
            )
        joined_context = "\n---\n".join(context_blocks)

        prompt = f"""
Developer Goal: "{goal}"
Developer Experience Level: {experience_level}
Topic Focus: {topic or "General architecture"}

Retrieved Codebase Context:
{joined_context}

Plan an adaptive learning path consisting of 3-4 progressive lessons.
Output a JSON object with a "lessons" array where each lesson object contains:
- "title": Concise lesson title
- "objective": Specific technical learning outcome
- "why_it_matters": Why this architecture/code matters in production
- "explanation": Detailed explanation of inputs, conditions, outputs, and dependencies
- "chunk_index_refs": [1, 2] (integer list of 1-indexed references to provided context chunks)
- "exercise_prompt": One repository-specific short-answer question checking understanding
- "rubric_required_concepts": list of key technical concepts the developer must explain
- "rubric_acceptable_alternatives": list of valid alternative explanations
- "rubric_common_misconceptions": list of common novice mistakes to watch for
"""

        if not groq_service.is_configured():
            # Graceful fallback when GROQ_API_KEY is not configured yet
            return cls._generate_unconfigured_fallback_plan(chunks, goal)

        messages = [
            {
                "role": "system",
                "content": "You are a senior software architect creating an onboarding curriculum for a new developer."
            },
            {"role": "user", "content": prompt}
        ]

        try:
            plan = await groq_service.generate_structured(
                messages=messages,
                response_model=RawPathPlan,
                temperature=0.2
            )
            
            formatted_lessons = []
            for item in plan.lessons:
                # Map chunk indices to actual chunk records
                ref_chunks = []
                for c_idx in item.chunk_index_refs:
                    if 1 <= c_idx <= len(chunks):
                        c = chunks[c_idx - 1]
                        ref_chunks.append({
                            "chunk_id": c.id,
                            "file_path": c.file_path,
                            "symbol_name": c.symbol_name,
                            "start_line": c.start_line,
                            "end_line": c.end_line,
                            "code_snippet": c.original_code[:800]
                        })

                if not ref_chunks and chunks:
                    c = chunks[0]
                    ref_chunks.append({
                        "chunk_id": c.id,
                        "file_path": c.file_path,
                        "symbol_name": c.symbol_name,
                        "start_line": c.start_line,
                        "end_line": c.end_line,
                        "code_snippet": c.original_code[:800]
                    })

                formatted_lessons.append({
                    "title": item.title,
                    "objective": item.objective,
                    "why_it_matters": item.why_it_matters,
                    "explanation": item.explanation,
                    "code_references": ref_chunks,
                    "exercise_prompt": item.exercise_prompt,
                    "rubric": {
                        "required_concepts": item.rubric_required_concepts,
                        "acceptable_alternatives": item.rubric_acceptable_alternatives,
                        "common_misconceptions": item.rubric_common_misconceptions,
                        "answerable_from_code": True
                    }
                })
            return formatted_lessons

        except Exception as exc:
            logger.error("Failed to generate learning plan via Groq: %s", exc)
            return cls._generate_unconfigured_fallback_plan(chunks, goal)

    @staticmethod
    def _generate_unconfigured_fallback_plan(chunks: List[CodeChunk], goal: str) -> List[Dict[str, Any]]:
        """Provides a structured template when Groq API key is not yet set."""
        top_c = chunks[0] if chunks else None
        return [
            {
                "title": f"Core Foundations: {top_c.symbol_name or 'Entry Logic' if top_c else 'Overview'}",
                "objective": f"Understand how {top_c.symbol_name if top_c else 'the service'} fits into the system.",
                "why_it_matters": "Understanding this foundational module is essential before tracing downstream calls.",
                "explanation": "Inspect the parameters, return types, and validation rules defined in the source reference.",
                "code_references": [
                    {
                        "chunk_id": top_c.id if top_c else "chunk-1",
                        "file_path": top_c.file_path if top_c else "README.md",
                        "symbol_name": top_c.symbol_name if top_c else "Module",
                        "start_line": top_c.start_line if top_c else 1,
                        "end_line": top_c.end_line if top_c else 20,
                        "code_snippet": top_c.original_code[:600] if top_c else "# Source reference"
                    }
                ] if top_c else [],
                "exercise_prompt": "What parameters or conditions does this function validate before proceeding?",
                "rubric": {
                    "required_concepts": ["input validation", "return type handling"],
                    "acceptable_alternatives": ["sanity checks", "guard clauses"],
                    "common_misconceptions": ["assuming inputs are pre-sanitized"],
                    "answerable_from_code": True
                }
            }
        ]
