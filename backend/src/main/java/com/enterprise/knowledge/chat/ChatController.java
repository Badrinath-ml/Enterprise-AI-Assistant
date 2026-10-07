package com.enterprise.knowledge.chat;

import com.enterprise.knowledge.chat.dto.*;
import com.enterprise.knowledge.common.tenant.TenantContext;
import com.enterprise.knowledge.document.dto.DocumentResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chat")
@PreAuthorize("isAuthenticated()")
public class ChatController {
    private final ChatService chat;

    public ChatController(ChatService chat) {
        this.chat = chat;
    }

    @GetMapping("/conversations")
    public List<ChatConversationResponse> conversations(@AuthenticationPrincipal Jwt jwt) {
        return chat.list(TenantContext.getRequired(), UUID.fromString(jwt.getSubject()));
    }

    @PostMapping("/conversations")
    public ChatConversationResponse create(@RequestParam(required = false) String title,
                                           @AuthenticationPrincipal Jwt jwt) {
        return chat.create(TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), title);
    }

    @GetMapping("/conversations/{id}/messages")
    public ChatHistoryResponse history(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return chat.history(TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), id);
    }

    @PostMapping("/conversations/{id}/messages")
    public ChatSendResponse send(@PathVariable UUID id,
                                  @RequestParam String message,
                                  @AuthenticationPrincipal Jwt jwt) {
        return chat.send(TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), id, message);
    }

    @PostMapping("/conversations/{id}/upload")
    public DocumentResponse upload(@PathVariable UUID id, @RequestParam MultipartFile file,
                                   @AuthenticationPrincipal Jwt jwt) {
        return chat.upload(TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), id, file);
    }

    @GetMapping("/sources/{documentId}")
    public ChatSourceResponse source(@PathVariable UUID documentId,
                                     @AuthenticationPrincipal Jwt jwt) {
        return chat.source(TenantContext.getRequired(), UUID.fromString(jwt.getSubject()), documentId);
    }
}
