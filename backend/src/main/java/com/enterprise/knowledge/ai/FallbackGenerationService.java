package com.enterprise.knowledge.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;

public class FallbackGenerationService implements GenerationService {
    private static final Logger log = LoggerFactory.getLogger(FallbackGenerationService.class);

    private final GenerationService primary;
    private final GenerationService fallback;

    public FallbackGenerationService(
            @Qualifier("grokGenerationService") GenerationService primary,
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
                log.info("Primary Grok generation failed with HTTP {}, switching to fallback", e.getStatusCode());
                return fallback.generate(request);
            }
            throw e;
        } catch (ResourceAccessException e) {
            log.info("Primary Grok generation timed out/unreachable, switching to fallback");
            return fallback.generate(request);
        } catch (IllegalStateException e) {
            log.info("Primary Grok generation unavailable ({}), switching to fallback", e.getMessage());
            return fallback.generate(request);
        }
    }
}
