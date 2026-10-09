package com.enterprise.knowledge.document.ingestion;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Common beans for embedding and external HTTP services.
 * GoogleEmbeddingService is active as @Service @Primary.
 */
@Configuration
public class EmbeddingConfiguration {

    @Bean
    RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }
}
