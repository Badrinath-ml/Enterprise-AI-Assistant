package com.enterprise.knowledge.ai;

import java.util.List;

public interface CrossEncoderRerankerService {
    List<Double> rerank(String query, List<String> documents);
    String model();
}
