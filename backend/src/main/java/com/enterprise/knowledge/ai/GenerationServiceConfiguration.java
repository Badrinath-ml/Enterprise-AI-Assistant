package com.enterprise.knowledge.ai;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class GenerationServiceConfiguration {
    @Bean
    @Primary
    GenerationService generationService(
            GeminiGenerationService geminiGenerationService,
            HuggingFaceGenerationService huggingFaceGenerationService) {
        return new FallbackGenerationService(geminiGenerationService, huggingFaceGenerationService);
    }
    
    @Bean
    @Primary
    StreamingGenerationService streamingGenerationService(
            GeminiGenerationService geminiGenerationService,
            HuggingFaceGenerationService huggingFaceGenerationService) {
        return new FallbackStreamingGenerationService(geminiGenerationService, huggingFaceGenerationService);
    }
}

