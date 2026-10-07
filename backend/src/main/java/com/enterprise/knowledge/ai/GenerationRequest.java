package com.enterprise.knowledge.ai;

public record GenerationRequest(
        String systemInstruction,
        String userPrompt
) {
    public GenerationRequest {
        if (userPrompt == null || userPrompt.isBlank()) {
            throw new IllegalArgumentException("Generation prompt cannot be blank");
        }
        systemInstruction = systemInstruction == null ? "" : systemInstruction;
    }
}
