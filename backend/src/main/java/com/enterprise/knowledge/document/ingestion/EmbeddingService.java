package com.enterprise.knowledge.document.ingestion;

import java.util.List;

/**
 * Provider-neutral embedding contract.
 *
 * Document and query embeddings must come from the same embedding model/space.
 */
public interface EmbeddingService {
    List<float[]> embedDocuments(List<String> texts);
    float[] embedQuery(String query);
    String provider();
    String model();
    int dimensions();
}
