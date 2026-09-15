import logging
from typing import List, Dict, Any, Optional
from apps.api.app.models.repository import CodeChunk
from apps.api.app.schemas.chat import Citation

logger = logging.getLogger(__name__)

class CitationValidator:
    """
    Validates model-cited source evidence against canonical database records.
    Prevents hallucinated file paths, non-existent symbol names, or fabricated line ranges.
    """

    @classmethod
    def validate_and_resolve(
        cls,
        raw_citations: List[Dict[str, Any]],
        available_chunks: List[CodeChunk]
    ) -> List[Citation]:
        chunk_map = {c.id: c for c in available_chunks}
        # Also index by index string (e.g., "chunk-1", "1", "chunk_1")
        indexed_map = {}
        for idx, c in enumerate(available_chunks, start=1):
            indexed_map[f"chunk_{idx}"] = c
            indexed_map[f"chunk-{idx}"] = c
            indexed_map[f"chunk{idx}"] = c
            indexed_map[str(idx)] = c
            indexed_map[c.id] = c

        resolved: List[Citation] = []
        seen_keys = set()

        for item in raw_citations:
            ref_id = str(item.get("chunk_id", "")).strip()
            claim = item.get("claim")

            chunk = chunk_map.get(ref_id) or indexed_map.get(ref_id)
            if not chunk:
                # If ref_id mentions filename, attempt match
                for c in available_chunks:
                    if ref_id.lower() in c.file_path.lower() or (c.symbol_name and ref_id.lower() in c.symbol_name.lower()):
                        chunk = c
                        break

            if not chunk:
                logger.warning("Rejecting unresolvable citation ref '%s'", ref_id)
                continue

            unique_key = (chunk.id, chunk.start_line, chunk.end_line)
            if unique_key in seen_keys:
                continue
            seen_keys.add(unique_key)

            resolved.append(
                Citation(
                    chunk_id=chunk.id,
                    file_path=chunk.file_path,
                    symbol_name=chunk.symbol_name,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    snippet=chunk.original_code[:800],  # Concise snippet preview
                    claim=claim
                )
            )

        # If model returned no citations but context was provided, default to top 1-2 retrieved chunks as evidence
        if not resolved and available_chunks:
            top_chunk = available_chunks[0]
            resolved.append(
                Citation(
                    chunk_id=top_chunk.id,
                    file_path=top_chunk.file_path,
                    symbol_name=top_chunk.symbol_name,
                    start_line=top_chunk.start_line,
                    end_line=top_chunk.end_line,
                    snippet=top_chunk.original_code[:800],
                    claim="Relevant source context retrieved for this query"
                )
            )

        return resolved
