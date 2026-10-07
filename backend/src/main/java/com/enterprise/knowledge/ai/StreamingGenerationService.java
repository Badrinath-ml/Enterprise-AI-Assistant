package com.enterprise.knowledge.ai;

import java.util.function.Consumer;

public interface StreamingGenerationService {
    GenerationResponse stream(GenerationRequest request, Consumer<String> onToken);
}
