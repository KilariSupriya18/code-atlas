import asyncio
import json
import logging
from typing import Any, Dict, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError
from groq import AsyncGroq, RateLimitError, APIConnectionError, APIStatusError
from apps.api.app.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

class GroqService:
    """
    Central adapter for all generative Groq API interactions.
    Handles async requests, concurrency limits, exponential backoff retries,
    JSON structured output validation, fallback model switching, and safe logging.
    """

    def __init__(self):
        self._client: Optional[AsyncGroq] = None
        self._semaphore = asyncio.Semaphore(5)  # Limit concurrent Groq calls to respect rate limits

    def get_client(self) -> Optional[AsyncGroq]:
        if not settings.groq_api_key:
            return None
        if self._client is None:
            self._client = AsyncGroq(api_key=settings.groq_api_key)
        return self._client

    def is_configured(self) -> bool:
        return bool(settings.groq_api_key and settings.groq_api_key.strip())

    async def generate_structured(
        self,
        messages: list[dict],
        response_model: Type[T],
        temperature: float = 0.2,
        max_tokens: int = 4096,
        allow_fallback: bool = True
    ) -> T:
        """
        Executes a chat completion expecting structured JSON, validates it against Pydantic schema,
        and performs at most one repair attempt if validation fails.
        """
        client = self.get_client()
        if not client:
            raise ValueError(
                "GROQ_API_KEY is not configured. Please add your Groq API key in Settings or in the server .env file."
            )

        model = settings.groq_model
        async with self._semaphore:
            try:
                return await self._call_with_retry(
                    client=client,
                    model=model,
                    messages=messages,
                    response_model=response_model,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
            except Exception as exc:
                if allow_fallback and settings.groq_fallback_model and settings.groq_fallback_model != model:
                    logger.warning("Primary model %s failed with %s; attempting fallback %s", model, exc, settings.groq_fallback_model)
                    return await self._call_with_retry(
                        client=client,
                        model=settings.groq_fallback_model,
                        messages=messages,
                        response_model=response_model,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                raise

    async def _call_with_retry(
        self,
        client: AsyncGroq,
        model: str,
        messages: list[dict],
        response_model: Type[T],
        temperature: float,
        max_tokens: int
    ) -> T:
        max_retries = 2
        delay = 1.5

        for attempt in range(max_retries + 1):
            try:
                # Ask explicitly for JSON and use JSON mode
                system_instruction = (
                    "You are a strict technical engine. Output valid, parseable JSON conforming to the requested schema. "
                    "Do NOT include markdown backticks around the json or extra explanatory text outside the JSON object."
                )
                
                merged_messages = [{"role": "system", "content": system_instruction}] + messages

                response = await client.chat.completions.create(
                    model=model,
                    messages=merged_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format={"type": "json_object"}
                )

                content = response.choices[0].message.content or "{}"
                
                # Attempt to parse and validate
                try:
                    data = json.loads(content)
                    return response_model.model_validate(data)
                except (json.JSONDecodeError, ValidationError) as val_err:
                    if attempt < max_retries:
                        logger.warning("Structured output validation failed (%s). Attempting bounded repair prompt.", val_err)
                        repair_prompt = [
                            {"role": "system", "content": system_instruction},
                            {"role": "user", "content": f"The previous response failed schema validation with error: {str(val_err)[:200]}. Here was the raw output:\n{content}\nPlease fix it and output strictly valid JSON matching the schema."}
                        ]
                        repair_res = await client.chat.completions.create(
                            model=model,
                            messages=repair_prompt,
                            temperature=0.1,
                            response_format={"type": "json_object"}
                        )
                        repaired_data = json.loads(repair_res.choices[0].message.content or "{}")
                        return response_model.model_validate(repaired_data)
                    raise val_err

            except RateLimitError as rle:
                if attempt < max_retries:
                    retry_after = delay * (2 ** attempt)
                    logger.warning("Groq rate limit encountered. Backing off for %.1f seconds...", retry_after)
                    await asyncio.sleep(retry_after)
                else:
                    raise RuntimeError(f"Groq rate limit exceeded after {max_retries} retries.") from rle
            except APIConnectionError as ace:
                if attempt < max_retries:
                    await asyncio.sleep(delay)
                else:
                    raise RuntimeError(f"Failed to connect to Groq API: {ace}") from ace
            except APIStatusError as ase:
                raise RuntimeError(f"Groq API error ({ase.status_code}): {ase.message}") from ase

# Singleton provider instance
groq_service = GroqService()
