import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  X,
  Maximize2,
  Send,
  Loader2,
  BookOpen,
  MessageSquare,
} from 'lucide-react';
import { chatApi } from '../../api/chat';
import { ChatCitation, ChatMessage } from '../../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SourcesModal } from '../../pages/chat/SourcesModal';

export const FloatingAssistant: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitations, setActiveCitations] = useState<ChatCitation[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // If already on the full chat page, hide the floating widget
  const isOnChatPage = location.pathname.startsWith('/chat');

  useEffect(() => {
    if (!isOpen) return;
    // Load most recent conversation if none selected
    const initConversation = async () => {
      try {
        const convos = await chatApi.getConversations();
        if (convos.length > 0) {
          setConversationId(convos[0].id);
          const history = await chatApi.getHistory(convos[0].id);
          setMessages(history.messages);
        }
      } catch {
        // Conversation init fallback
      }
    };

    if (!conversationId) {
      initConversation();
    }
  }, [isOpen, conversationId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  if (isOnChatPage) {
    return null;
  }

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || isLoading) return;

    setInput('');
    setIsLoading(true);

    let activeId = conversationId;
    try {
      if (!activeId) {
        const created = await chatApi.createConversation();
        activeId = created.id;
        setConversationId(created.id);
      }

      const tempUserId = `user-${Date.now()}`;
      const tempAssistantId = `assistant-${Date.now()}`;

      const userMsg: ChatMessage = {
        id: tempUserId,
        role: 'USER',
        content: prompt,
        createdAt: new Date().toISOString(),
        citations: [],
      };

      const assistantMsg: ChatMessage = {
        id: tempAssistantId,
        role: 'ASSISTANT',
        content: '',
        createdAt: new Date().toISOString(),
        citations: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      await chatApi.stream(
        activeId,
        prompt,
        (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId ? { ...m, content: m.content + token } : m
            )
          );
        },
        (citation) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId && !m.citations.some((c) => c.id === citation.id)
                ? { ...m, citations: [...m.citations, citation] }
                : m
            )
          );
        }
      );

      // Refresh final turn with server truth
      const history = await chatApi.getHistory(activeId);
      setMessages(history.messages);
    } catch (err) {
      const errMsg = (err as { message?: string }).message || 'Failed to generate answer.';
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'ASSISTANT',
          content: `⚠️ ${errMsg}`,
          createdAt: new Date().toISOString(),
          citations: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleExpandToFullPage = () => {
    setIsOpen(false);
    navigate('/chat');
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40 select-none">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? 'Close Assistant' : 'Open Knowledge Assistant'}
          title="Enterprise AI Assistant"
          className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl hover:shadow-indigo-500/25 transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 border border-indigo-400/30"
        >
          {isOpen ? (
            <X className="w-6 h-6 transition-transform rotate-0 group-hover:rotate-90 duration-200" />
          ) : (
            <>
              <Sparkles className="w-6 h-6 transition-transform group-hover:scale-110" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Floating Assistant Compact Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Enterprise Assistant Compact Window"
          className="fixed bottom-24 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-[420px] h-[550px] max-h-[calc(100vh-7rem)] bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1f1f1f] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="p-3.5 bg-slate-50 dark:bg-[#070707] border-b border-slate-200 dark:border-[#1f1f1f] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  Enterprise Assistant
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  Grounded Knowledge Retrieval
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleExpandToFullPage}
                title="Expand to Full Assistant View"
                aria-label="Expand to full assistant"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#18181b] transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                aria-label="Close assistant"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#182338] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Conversation Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-[#182338] text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 border border-indigo-100 dark:border-[#22314a]">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  How can I help you today?
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mb-4">
                  Ask questions about approved organization documents, policies, or operational guides.
                </p>

                <div className="space-y-2 w-full text-left">
                  {[
                    'What are our security & data policies?',
                    'Explain the document review process',
                    'Where can I find operational guidelines?',
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0c121e] hover:bg-slate-100 dark:hover:bg-[#182338] border border-slate-200 dark:border-[#1f2d44] text-[11px] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer truncate"
                    >
                      💡 {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === 'USER' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                      m.role === 'USER'
                        ? 'bg-indigo-600 text-white rounded-br-xs'
                        : 'bg-slate-100 dark:bg-[#0c121e] border border-slate-200 dark:border-[#1f2d44] text-slate-800 dark:text-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {m.role === 'USER' ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    ) : (
                      <>
                        <MarkdownRenderer content={m.content} />
                        {m.citations && m.citations.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-[#1f2d44]">
                            <button
                              onClick={() => setActiveCitations(m.citations)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>{m.citations.length} Verified Sources</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>Searching enterprise knowledge...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-slate-200 dark:border-[#1f1f1f] bg-slate-50/50 dark:bg-[#070707]">
            <div className="flex items-end gap-2 p-1.5 rounded-xl border border-slate-300 dark:border-[#27272a] bg-white dark:bg-[#0f0f11] focus-within:ring-2 focus-within:ring-indigo-500/30">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask about workspace documents..."
                className="flex-1 max-h-24 resize-none bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none px-2 py-1.5 leading-relaxed"
              />
              <button
                disabled={!input.trim() || isLoading}
                onClick={() => handleSendMessage()}
                aria-label="Send message"
                className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 px-1">
              <span>Enter to send · Shift+Enter for new line</span>
              <button
                onClick={handleExpandToFullPage}
                className="hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
              >
                Full view →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sources modal inside floating widget */}
      {activeCitations && (
        <SourcesModal
          isOpen={!!activeCitations}
          citations={activeCitations}
          onClose={() => setActiveCitations(null)}
          onSelectCitation={() => {
            setActiveCitations(null);
            handleExpandToFullPage();
          }}
        />
      )}
    </>
  );
};
