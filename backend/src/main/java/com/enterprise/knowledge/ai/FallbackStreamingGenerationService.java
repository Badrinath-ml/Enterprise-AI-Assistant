package com.enterprise.knowledge.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

public class FallbackStreamingGenerationService implements StreamingGenerationService {
    private static final Logger log = LoggerFactory.getLogger(FallbackStreamingGenerationService.class);

    private final StreamingGenerationService primary;
    private final StreamingGenerationService fallback;

    public FallbackStreamingGenerationService(
            StreamingGenerationService primary,
            StreamingGenerationService fallback) {
        this.primary = primary;
        this.fallback = fallback;
    }

    @Override
    public GenerationResponse stream(GenerationRequest request, Consumer<String> onToken) {
        AtomicBoolean emitted = new AtomicBoolean(false);
        Consumer<String> guarded = token -> {
            emitted.set(true);
            onToken.accept(token);
        };

        try {
            return primary.stream(request, guarded);
        } catch (HttpStatusCodeException e) {
            if (!emitted.get() && (e.getStatusCode().is5xxServerError() || e.getStatusCode().value() == 429)) {
                log.info("Primary Grok streaming failed (HTTP {}), switching to fallback", e.getStatusCode());
                return fallback.stream(request, onToken);
            }
            throw e;
        } catch (ResourceAccessException e) {
            if (!emitted.get()) {
                log.info("Primary Grok streaming timed out/unreachable, switching to fallback");
                return fallback.stream(request, onToken);
            }
            throw e;
        } catch (IllegalStateException e) {
            if (!emitted.get()) {
                log.info("Primary Grok streaming unavailable ({}), switching to fallback", e.getMessage());
                return fallback.stream(request, onToken);
            }
            throw e;
        }
    }
}
