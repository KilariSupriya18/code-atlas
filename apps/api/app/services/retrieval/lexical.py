import re
from typing import List, Dict, Any, Tuple
from rank_bm25 import BM25Okapi, BM25Plus
from apps.api.app.models.repository import CodeChunk

class LexicalRetriever:
    """
    Performs true ranked lexical search using BM25Okapi over code symbols, signatures,
    docstrings, and tokenized source code, plus exact identifier boost.
    """

    @staticmethod
    def tokenize(text: str) -> List[str]:
        if not text:
            return []
        # Split on snake_case, camelCase, dots, and non-alphanumeric
        tokens = re.findall(r'[A-Za-z0-9]+', text.lower())
        return tokens

    @classmethod
    def rank_bm25(cls, chunks: List[CodeChunk], query: str, limit: int = 15) -> List[Dict[str, Any]]:
        if not chunks:
            return []
        
        tokenized_corpus = []
        for c in chunks:
            text = f"{c.file_path} {c.symbol_name or ''} {c.signature or ''} {c.docstring or ''} {c.original_code}"
            tokenized_corpus.append(cls.tokenize(text))

        query_tokens = cls.tokenize(query)
        if not query_tokens:
            return []

        # Use BM25Plus to avoid zero/negative IDF on small corpora
        try:
            bm25 = BM25Plus(tokenized_corpus)
            doc_scores = bm25.get_scores(query_tokens)
        except Exception:
            bm25 = BM25Okapi(tokenized_corpus)
            doc_scores = bm25.get_scores(query_tokens)

        scored = []
        for i in range(len(chunks)):
            # Include if BM25 score > 0 or has token overlap
            has_overlap = any(t in tokenized_corpus[i] for t in query_tokens)
            score = float(doc_scores[i])
            if score > 0.0 or has_overlap:
                scored.append({"chunk": chunks[i], "score": max(score, 0.1 if has_overlap else 0.0)})

        scored.sort(key=lambda x: x["score"], reverse=True)

        results = []
        for rank, item in enumerate(scored[:limit], start=1):
            results.append({
                "chunk_id": item["chunk"].id,
                "score": item["score"],
                "rank": rank,
                "chunk": item["chunk"]
            })
        return results

    @classmethod
    def find_exact_identifiers(cls, chunks: List[CodeChunk], query: str) -> List[Dict[str, Any]]:
        """Identifies chunks whose symbol_name or file_path matches tokens in the query."""
        query_lower = query.lower()
        query_words = set(cls.tokenize(query_lower))
        
        matches = []
        for c in chunks:
            sym = (c.symbol_name or "").lower()
            fp = c.file_path.lower()
            
            score = 0
            if sym and (sym in query_lower or sym in query_words):
                score += 10
            # Check filename match (e.g. security.py -> "security")
            filename = fp.split("/")[-1].split(".")[0]
            if filename in query_words:
                score += 5
                
            if score > 0:
                matches.append({"chunk_id": c.id, "score": score, "chunk": c})
        
        matches.sort(key=lambda x: x["score"], reverse=True)
        return [
            {"chunk_id": m["chunk_id"], "score": m["score"], "rank": r, "chunk": m["chunk"]}
            for r, m in enumerate(matches, start=1)
        ]
