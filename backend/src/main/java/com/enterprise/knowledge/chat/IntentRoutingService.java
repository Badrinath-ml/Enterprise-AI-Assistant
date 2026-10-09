package com.enterprise.knowledge.chat;

import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class IntentRoutingService {

    private static final Pattern GREETING_PATTERN = Pattern.compile(
            "^(hi(\\s+there)?|hello(\\s+there)?|hey(\\s+there)?|greetings|good\\s+(morning|afternoon|evening|day)|howdy|sup|what's\\s+up|how\\s+are\\s+you)[!.,? ]*$",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern IDENTITY_PATTERN = Pattern.compile(
            "^(who\\s+are\\s+you|what\\s+are\\s+you|what\\s+is\\s+your\\s+name|what\\s+can\\s+you\\s+do|introduce\\s+yourself|tell\\s+me\\s+about\\s+yourself|what\\s+is\\s+this\\s+assistant)[!.,? ]*$",
            Pattern.CASE_INSENSITIVE
    );

    private static final Set<String> ENTERPRISE_KEYWORDS = Set.of(
            "policy", "policies", "handbook", "leave", "pto", "vacation", "holiday", "holidays",
            "benefit", "benefits", "insurance", "reimbursement", "expense", "expenses",
            "procedure", "procedures", "guideline", "guidelines", "compliance", "audit",
            "security", "confidential", "internal", "org", "organization", "company", "department",
            "employee", "employees", "manager", "managers", "onboarding", "nda", "contract",
            "wfh", "remote work", "work from home", "vpn", "code of conduct", "sla", "sop",
            "incident", "travel", "maternity", "paternity", "sick leave", "overtime",
            "attachment", "attachments", "document", "documents", "standard", "nist", "iso"
    );

    private static final Set<String> GENERAL_QUESTION_STARTERS = Set.of(
            "what is the capital", "how far is", "solve", "calculate", "write a python",
            "write a function", "write a script", "explain how", "who invented", "when was",
            "translate", "summarize the plot", "what is photosynthesis", "how do airplanes fly"
    );

    public QueryIntent classify(String query) {
        if (query == null || query.isBlank()) {
            return QueryIntent.GREETING;
        }

        String trimmed = query.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);

        if (GREETING_PATTERN.matcher(trimmed).matches()) {
            return QueryIntent.GREETING;
        }

        if (IDENTITY_PATTERN.matcher(trimmed).matches()) {
            return QueryIntent.IDENTITY;
        }

        boolean hasEnterpriseKeyword = false;
        for (String kw : ENTERPRISE_KEYWORDS) {
            if (containsWordOrPhrase(lower, kw)) {
                hasEnterpriseKeyword = true;
                break;
            }
        }

        boolean hasGeneralExplanation = lower.contains("why in general")
                || lower.contains("best practice in industry")
                || lower.contains("explain the general concept")
                || (lower.contains(" and ") && (lower.contains("why ") || lower.contains("how does ")));

        if (hasEnterpriseKeyword && hasGeneralExplanation) {
            return QueryIntent.MIXED;
        }

        if (hasEnterpriseKeyword) {
            return QueryIntent.ENTERPRISE;
        }

        for (String starter : GENERAL_QUESTION_STARTERS) {
            if (lower.startsWith(starter) || lower.contains(starter)) {
                return QueryIntent.GENERAL;
            }
        }

        // If the query is asking about code/general programming or math or world facts without enterprise keywords
        if (isLikelyGeneralKnowledge(lower)) {
            return QueryIntent.GENERAL;
        }

        // Default to ENTERPRISE for domain safety so company knowledge is checked
        return QueryIntent.ENTERPRISE;
    }

    private boolean isLikelyGeneralKnowledge(String lower) {
        return (lower.startsWith("write a ") && (lower.contains("code") || lower.contains("function") || lower.contains("class") || lower.contains("regex")))
                || (lower.startsWith("what is ") && (lower.contains("capital") || lower.contains("formula") || lower.contains("speed of light") || lower.contains("pi ")))
                || (lower.startsWith("how to ") && (lower.contains("cook") || lower.contains("bake") || lower.contains("knit") || lower.contains("reverse a string")));
    }

    private boolean containsWordOrPhrase(String text, String phrase) {
        if (phrase.contains(" ")) {
            return text.contains(phrase);
        }
        return Pattern.compile("\\b" + Pattern.quote(phrase) + "\\b").matcher(text).find();
    }
}
