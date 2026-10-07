package com.enterprise.knowledge.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class AsyncConfig {
    @Bean(name = "documentIngestionExecutor")
    public ThreadPoolTaskExecutor documentIngestionExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2); executor.setMaxPoolSize(4); executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("document-ingestion-"); executor.initialize(); return executor;
    }
}
