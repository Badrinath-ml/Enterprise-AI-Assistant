package com.enterprise.knowledge.ai;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class GenerationServiceConfiguration {

    @Bean
    @Primary
    GenerationService generationService(
            GrokGenerationService grokGenerationService,
            HuggingFaceGenerationService huggingFaceGenerationService) {
        return new FallbackGenerationService(grokGenerationService, huggingFaceGenerationService);
    }

    @Bean
    @Primary
    StreamingGenerationService streamingGenerationService(
            GrokGenerationService grokGenerationService,
            HuggingFaceGenerationService huggingFaceGenerationService) {
        return new FallbackStreamingGenerationService(grokGenerationService, huggingFaceGenerationService);
    }
}
