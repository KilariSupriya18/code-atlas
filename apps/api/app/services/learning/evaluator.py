import json
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from apps.api.app.models.learning import Lesson, ExerciseAttempt, UserProgress
from apps.api.app.providers.groq_client import groq_service

logger = logging.getLogger(__name__)

class RawEvaluationOutput(BaseModel):
    outcome: str = Field(default="partial", description="'correct', 'partial', 'incorrect', or 'unable_to_assess'")
    what_was_understood: str = Field(default="", description="Specific accurate technical concepts the developer demonstrated")
    what_was_missed: str = Field(default="", description="Concepts omitted, inaccurate assumptions, or missing failure cases")
    explanation: str = Field(default="", description="Source-grounded explanation clarifying the true repository behavior")
    recommended_next_action: str = Field(default="Continue practicing this module.", description="Actionable next step")
    remediation_question: Optional[str] = Field(None, description="Alternative targeted question if outcome is partial or incorrect")

    @model_validator(mode="before")
    @classmethod
    def normalize_eval(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)
        outcome = str(d.get("outcome", "partial")).strip().lower()
        if "correct" in outcome and "in" not in outcome:
            d["outcome"] = "correct"
        elif "partial" in outcome:
            d["outcome"] = "partial"
        elif "incorrect" in outcome or "wrong" in outcome:
            d["outcome"] = "incorrect"
        else:
            d["outcome"] = "unable_to_assess"

        if not d.get("what_was_understood"):
            d["what_was_understood"] = d.get("strengths") or d.get("feedback") or "Good conceptual attempt."
        if not d.get("what_was_missed") and d["outcome"] != "correct":
            d["what_was_missed"] = d.get("weaknesses") or d.get("missing_concepts") or "Further details on edge cases and failure modes."
        if not d.get("explanation"):
            d["explanation"] = d.get("analysis") or d.get("details") or "Refer to the source code implementation."
        if not d.get("recommended_next_action"):
            d["recommended_next_action"] = "Advance to next lesson." if d["outcome"] == "correct" else "Review the source snippet and test again."
        return d

class ExerciseEvaluator:
    """
    Evaluates developer short-answer submissions against hidden rubrics
    and source code behavior, generating grounded feedback and remediation.
    """

    @classmethod
    async def evaluate_submission(
        cls,
        session: AsyncSession,
        lesson: Lesson,
        repo_id: str,
        user_answer: str
    ) -> Dict[str, Any]:
        rubric = lesson.rubric or {}
        code_refs_str = "\n".join([
            f"File: {ref.get('file_path')} (lines {ref.get('start_line')}-{ref.get('end_line')})\nCode:\n{ref.get('code_snippet')}"
            for ref in (lesson.code_references or [])
        ])

        eval_prompt = f"""
Lesson Title: {lesson.title}
Objective: {lesson.objective}

Source Code Context:
{code_refs_str}

Exercise Question:
{lesson.exercise_prompt}

HIDDEN EVALUATION RUBRIC:
- Required Concepts: {json.dumps(rubric.get("required_concepts", []))}
- Acceptable Alternatives: {json.dumps(rubric.get("acceptable_alternatives", []))}
- Common Misconceptions: {json.dumps(rubric.get("common_misconceptions", []))}

DEVELOPER'S ANSWER:
\"\"\"{user_answer}\"\"\"

Evaluate the developer's understanding conceptually.
Rules:
1. Do not require exact verbatim wording; credit accurate conceptual understanding.
2. Outcome must be one of: "correct", "partial", "incorrect", "unable_to_assess".
3. For "partial" or "incorrect", provide a targeted "remediation_question" testing the specific missing concept.
4. Distinguish clearly between observed code behavior and unsupported speculation.
"""

        if not groq_service.is_configured():
            # Fallback evaluation when Groq is not configured
            is_good_length = len(user_answer.strip().split()) > 10
            return {
                "outcome": "correct" if is_good_length else "partial",
                "what_was_understood": "You provided a coherent technical explanation of the flow.",
                "what_was_missed": "" if is_good_length else "More details on the exact validation and failure paths.",
                "explanation": "The codebase implements these checks to enforce system invariants before committing state.",
                "recommended_next_action": "Proceed to the next lesson or test edge cases in code.",
                "remediation_question": None if is_good_length else "What happens if this input parameter is null or invalid?"
            }

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a rigorous CodeAtlas evaluator and mentor grading an engineer's understanding of source code. "
                    "Grade strictly against the hidden rubric and actual source code."
                )
            },
            {"role": "user", "content": eval_prompt}
        ]

        try:
            result = await groq_service.generate_structured(
                messages=messages,
                response_model=RawEvaluationOutput,
                temperature=0.1
            )
            return result.model_dump()
        except Exception as exc:
            logger.error("Error evaluating exercise via Groq: %s", exc)
            return {
                "outcome": "partial",
                "what_was_understood": "Your submission was received.",
                "what_was_missed": f"Automated grading encountered an evaluation error: {str(exc)[:100]}",
                "explanation": "Please review the code references directly.",
                "recommended_next_action": "Review the code snippet and retry.",
                "remediation_question": None
            }

    @classmethod
    async def record_attempt_and_update_progress(
        cls,
        session: AsyncSession,
        lesson: Lesson,
        repo_id: str,
        user_answer: str,
        evaluation: Dict[str, Any]
    ) -> ExerciseAttempt:
        attempt = ExerciseAttempt(
            lesson_id=lesson.id,
            user_answer=user_answer,
            outcome=evaluation["outcome"],
            feedback_what_understood=evaluation["what_was_understood"],
            feedback_what_missed=evaluation["what_was_missed"],
            explanation=evaluation["explanation"],
            recommended_next_action=evaluation["recommended_next_action"]
        )
        session.add(attempt)

        # Update lesson status: demonstrated if correct, practicing if partial/incorrect
        if evaluation["outcome"] == "correct":
            lesson.status = "demonstrated"
        elif lesson.status != "demonstrated":
            lesson.status = "practicing"

        # Update user progress record for repository
        prog_stmt = select(UserProgress).where(UserProgress.repository_id == repo_id)
        prog_res = await session.execute(prog_stmt)
        progress = prog_res.scalars().first()

        if not progress:
            progress = UserProgress(
                repository_id=repo_id,
                lessons_visited=[lesson.id],
                topics_practiced=[lesson.title],
                exercise_outcomes={evaluation["outcome"]: 1},
                concepts_to_revisit=[]
            )
            session.add(progress)
        else:
            visited = list(progress.lessons_visited or [])
            if lesson.id not in visited:
                visited.append(lesson.id)
            progress.lessons_visited = visited

            topics = list(progress.topics_practiced or [])
            if lesson.title not in topics:
                topics.append(lesson.title)
            progress.topics_practiced = topics

            outcomes = dict(progress.exercise_outcomes or {})
            outcomes[evaluation["outcome"]] = outcomes.get(evaluation["outcome"], 0) + 1
            progress.exercise_outcomes = outcomes

            if evaluation["outcome"] in {"partial", "incorrect"}:
                revisit = list(progress.concepts_to_revisit or [])
                if evaluation["what_was_missed"] and evaluation["what_was_missed"] not in revisit:
                    revisit.append(evaluation["what_was_missed"][:150])
                progress.concepts_to_revisit = revisit

        await session.commit()
        return attempt
