import os
import logging
from typing import List
import numpy as np
from sentence_transformers import SentenceTransformer
from apps.api.app.config import settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    Manages local vector embedding generation using Sentence Transformers.
    Runs locally on CPU/GPU without external API calls or invented embeddings.
    """

    def __init__(self):
        self._model: SentenceTransformer | None = None
        self.model_name = settings.embedding_model
        self.dimensions = settings.embedding_dimensions
        self.max_seq_length = settings.embedding_max_seq_length
        self.cache_dir = os.path.abspath("./data/model_cache")
        os.makedirs(self.cache_dir, exist_ok=True)

    def get_model(self) -> SentenceTransformer:
        if self._model is None:
            target = self.model_name
            local_path = os.path.abspath("./data/models/bge-small-en-v1.5")
            if os.path.isdir(local_path):
                target = local_path
            logger.info("Loading SentenceTransformer model from '%s'...", target)
            try:
                self._model = SentenceTransformer(
                    target,
                    cache_folder=self.cache_dir
                )
                self._model.max_seq_length = self.max_seq_length
                logger.info("SentenceTransformer '%s' loaded successfully.", target)
            except Exception as exc:
                logger.error("Failed to load SentenceTransformer '%s': %s", self.model_name, exc)
                raise RuntimeError(
                    f"Failed to load embedding model '{self.model_name}'. Check internet connectivity and local model cache: {exc}"
                ) from exc
        return self._model

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generates L2-normalized embeddings for a list of text chunks."""
        if not texts:
            return []
        
        model = self.get_model()
        # Truncation is handled safely by model.max_seq_length, but large functions are split upstream
        embeddings = model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        return embeddings.tolist()

    def embed_query(self, query: str) -> List[float]:
        """Generates L2-normalized embedding for a search query."""
        results = self.embed_texts([query])
        return results[0]

# Singleton embedding service
embedding_service = EmbeddingService()
