import os
import sys
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, CrossEncoder
import uvicorn

app = FastAPI(title="Enterprise Assistant Embedding & Reranking Service")

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-mpnet-base-v2")
RERANKER_MODEL_NAME = os.getenv("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")

print(f"Loading embedding model: {MODEL_NAME}...", flush=True)
embedding_model = SentenceTransformer(MODEL_NAME)
dimensions = embedding_model.get_sentence_embedding_dimension()
print(f"Embedding model loaded. Dimensions: {dimensions}", flush=True)

print(f"Loading reranker model: {RERANKER_MODEL_NAME}...", flush=True)
reranker_model = CrossEncoder(RERANKER_MODEL_NAME)
print(f"Reranker model loaded.", flush=True)

class EmbedRequest(BaseModel):
    texts: List[str]

class EmbedResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: List[List[float]]

class RerankRequest(BaseModel):
    query: str
    documents: List[str]

class RerankResponse(BaseModel):
    model: str
    scores: List[float]

@app.get("/health")
def health():
    return {
        "status": "UP",
        "provider": "sentence-transformers",
        "model": MODEL_NAME,
        "dimensions": dimensions,
        "reranker_model": RERANKER_MODEL_NAME
    }

@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    if not req.texts:
        return EmbedResponse(model=MODEL_NAME, dimensions=dimensions, embeddings=[])
    # Avoid empty text
    clean_texts = [t if t and t.strip() else " " for t in req.texts]
    embs = embedding_model.encode(clean_texts, convert_to_numpy=True, normalize_embeddings=True)
    return EmbedResponse(
        model=MODEL_NAME,
        dimensions=dimensions,
        embeddings=embs.tolist()
    )

@app.post("/rerank", response_model=RerankResponse)
def rerank(req: RerankRequest):
    if not req.documents:
        return RerankResponse(model=RERANKER_MODEL_NAME, scores=[])
    pairs = [[req.query, doc] for doc in req.documents]
    scores = reranker_model.predict(pairs)
    return RerankResponse(
        model=RERANKER_MODEL_NAME,
        scores=[float(s) for s in scores]
    )

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)
