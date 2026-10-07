package com.enterprise.knowledge.ai;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;

public class FallbackGenerationService implements GenerationService {
    private final GenerationService primary;
    private final GenerationService fallback;

    public FallbackGenerationService(
            @Qualifier("geminiGenerationService") GenerationService primary,
            @Qualifier("huggingFaceGenerationService") GenerationService fallback) {
        this.primary = primary;
        this.fallback = fallback;
    }

    @Override
    public GenerationResponse generate(GenerationRequest request) {
        try {
            return primary.generate(request);
        } catch (HttpStatusCodeException e) {
            if (e.getStatusCode().is5xxServerError() || e.getStatusCode().value() == 429) {
                return fallback.generate(request);
            }
            throw e;
        } catch (ResourceAccessException e) {
            return fallback.generate(request);
        }
    }
}
