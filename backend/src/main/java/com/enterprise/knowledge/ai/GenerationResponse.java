package com.enterprise.knowledge.ai;

public record GenerationResponse(
        String text,
        String provider,
        String model
) {}
