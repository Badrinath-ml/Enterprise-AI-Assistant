package com.enterprise.knowledge.chat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IntentRoutingServiceTest {

    private IntentRoutingService router;

    @BeforeEach
    void setUp() {
        router = new IntentRoutingService();
    }

    @Test
    @DisplayName("Greetings are routed to GREETING without document retrieval")
    void greetingsClassifiedCorrectly() {
        assertThat(router.classify("Hello")).isEqualTo(QueryIntent.GREETING);
        assertThat(router.classify("Hi there!")).isEqualTo(QueryIntent.GREETING);
        assertThat(router.classify("good morning")).isEqualTo(QueryIntent.GREETING);
        assertThat(router.classify("hey")).isEqualTo(QueryIntent.GREETING);
        assertThat(router.classify("How are you?")).isEqualTo(QueryIntent.GREETING);
    }

    @Test
    @DisplayName("Identity questions are routed to IDENTITY without document retrieval")
    void identityQuestionsClassifiedCorrectly() {
        assertThat(router.classify("Who are you?")).isEqualTo(QueryIntent.IDENTITY);
        assertThat(router.classify("What can you do?")).isEqualTo(QueryIntent.IDENTITY);
        assertThat(router.classify("Introduce yourself")).isEqualTo(QueryIntent.IDENTITY);
        assertThat(router.classify("What is this assistant?")).isEqualTo(QueryIntent.IDENTITY);
    }

    @Test
    @DisplayName("General knowledge questions are routed to GENERAL without internal search")
    void generalQuestionsClassifiedCorrectly() {
        assertThat(router.classify("What is the capital of France?")).isEqualTo(QueryIntent.GENERAL);
        assertThat(router.classify("Write a python function to reverse a string")).isEqualTo(QueryIntent.GENERAL);
        assertThat(router.classify("Write a regex to match email addresses")).isEqualTo(QueryIntent.GENERAL);
        assertThat(router.classify("Explain how airplanes fly")).isEqualTo(QueryIntent.GENERAL);
        assertThat(router.classify("How to bake sourdough bread")).isEqualTo(QueryIntent.GENERAL);
    }

    @Test
    @DisplayName("Enterprise policy and internal questions are routed to ENTERPRISE")
    void enterpriseQuestionsClassifiedCorrectly() {
        assertThat(router.classify("What is our remote work and WFH policy?")).isEqualTo(QueryIntent.ENTERPRISE);
        assertThat(router.classify("How many PTO days do employees get?")).isEqualTo(QueryIntent.ENTERPRISE);
        assertThat(router.classify("What are the travel reimbursement guidelines?")).isEqualTo(QueryIntent.ENTERPRISE);
        assertThat(router.classify("Explain our security and data privacy policies")).isEqualTo(QueryIntent.ENTERPRISE);
        assertThat(router.classify("What is the document approval process?")).isEqualTo(QueryIntent.ENTERPRISE);
    }

    @Test
    @DisplayName("Mixed questions combining policy and general background are routed to MIXED")
    void mixedQuestionsClassifiedCorrectly() {
        assertThat(router.classify("What is our password policy and why in general are passphrases more secure?"))
                .isEqualTo(QueryIntent.MIXED);
        assertThat(router.classify("What are our compliance guidelines and explain the general concept of SOC2?"))
                .isEqualTo(QueryIntent.MIXED);
    }
}
