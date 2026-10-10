import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileUp,
  Plus,
  Send,
  Sparkles,
  Paperclip,
  Loader2,
  BookOpen,
  Trash2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  CheckCircle2,
} from 'lucide-react';
import { chatApi } from '../../api/chat';
import { ChatCitation, ChatConversation, ChatMessage, ChatSource } from '../../types/chat';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { SourceViewer } from './SourceViewer';
import { SourcesModal } from './SourcesModal';
import { MarkdownRenderer } from '../../components/chat/MarkdownRenderer';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Avatar } from '../../components/common/Avatar';

const ACTIVE_CHAT_KEY = 'eka.activeChatId';
const SIDEBAR_STATE_KEY = 'eka.chatSidebarOpen';

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const { error, success } = useToast();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachedName, setAttachedName] = useState('');

  // ChatGPT-style collapsible sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (saved !== null) return saved === 'true';
    return window.innerWidth >= 1024;
  });

  // Mobile drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sources modal and Document Viewer state
  const [activeMessageCitations, setActiveMessageCitations] = useState<ChatCitation[] | null>(null);
  const [currentCitationsList, setCurrentCitationsList] = useState<ChatCitation[]>([]);
  const [sourceCitation, setSourceCitation] = useState<ChatCitation | null>(null);
  const [source, setSource] = useState<ChatSource | null>(null);

  // In-app conversation deletion state
  const [deletingConversation, setDeletingConversation] = useState<ChatConversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Scroll tracking to avoid forcing scroll when reading earlier messages
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STATE_KEY, String(next));
      return next;
    });
  };

  const loadConversations = useCallback(async () => {
    try {
      const items = await chatApi.getConversations();
      setConversations(items);
      const savedId = sessionStorage.getItem(ACTIVE_CHAT_KEY);
      const saved = savedId ? items.find((c) => c.id === savedId) : null;
      setActive((prev) => prev || saved || items[0] || null);
    } catch {
      error('Unable to load chat history.', 'Chat');
    }
  }, [error]);

  const loadHistory = useCallback(
    async (conversation: ChatConversation, showLoading = true) => {
      if (showLoading) setLoadingHistory(true);
      try {
        const result = await chatApi.getHistory(conversation.id);
        setMessages(result.messages);
        shouldAutoScrollRef.current = true;
      } catch {
        if (showLoading) error('Unable to load this conversation.', 'Chat');
      } finally {
        if (showLoading) setLoadingHistory(false);
      }
    },
    [error]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (active) {
      sessionStorage.setItem(ACTIVE_CHAT_KEY, active.id);
      loadHistory(active);
    } else {
      setMessages([]);
    }
  }, [active?.id, loadHistory]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    shouldAutoScrollRef.current = isNearBottom;
  };

  useEffect(() => {
    if (shouldAutoScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const newChat = async () => {
    try {
      const c = await chatApi.createConversation();
      setConversations((prev) => [c, ...prev]);
      setActive(c);
      setMessages([]);
      setMobileSidebarOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch {
      error('Unable to create a conversation.', 'Chat');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingConversation) return;
    setIsDeleting(true);
    try {
      await chatApi.deleteConversation(deletingConversation.id);
      setConversations((prev) => prev.filter((c) => c.id !== deletingConversation.id));
      if (active?.id === deletingConversation.id) {
        sessionStorage.removeItem(ACTIVE_CHAT_KEY);
        setActive(null);
        setMessages([]);
      }
      success('Conversation deleted.', 'Chat');
      setDeletingConversation(null);
    } catch {
      error('Unable to delete conversation.', 'Chat');
    } finally {
      setIsDeleting(false);
    }
  };

  const send = async (explicitText?: string) => {
    const value = (explicitText || input).trim();
    if (!value || loading) return;

    setInput('');
    setLoading(true);
    shouldAutoScrollRef.current = true;

    let targetConversation = active;
    if (!targetConversation) {
      try {
        targetConversation = await chatApi.createConversation();
        setConversations((prev) => [targetConversation!, ...prev]);
        setActive(targetConversation);
      } catch {
        error('Could not initialize conversation.', 'Assistant');
        setLoading(false);
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'USER',
      content: value,
      createdAt: new Date().toISOString(),
      citations: [],
    };
    const assistantId = `local-assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'ASSISTANT',
      content: '',
      createdAt: new Date().toISOString(),
      citations: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      await chatApi.stream(
        targetConversation.id,
        value,
        (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m
            )
          );
        },
        (citation) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && !m.citations.some((c) => c.id === citation.id)
                ? { ...m, citations: [...m.citations, citation] }
                : m
            )
          );
        }
      );

      // Replace temporary client-side message IDs with persisted messages without
      // switching the entire thread back to its initial history-loading screen.
      await loadHistory(targetConversation, false);
      await loadConversations();
    } catch (e) {
      const msg = (e as { message?: string }).message || 'Unable to generate an answer.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  m.content ||
                  `⚠️ **Failed to complete response:** ${msg}\n\nPlease verify network connection or try again.`,
              }
            : m
        )
      );
      error(msg, 'Assistant Error');
    } finally {
      setLoading(false);
    }
  };

  const upload = async (file: File) => {
    let target = active;
    if (!target) {
      try {
        target = await chatApi.createConversation();
        setConversations((prev) => [target!, ...prev]);
        setActive(target);
      } catch {
        error('Could not initialize conversation for upload.', 'Upload');
        return;
      }
    }

    const allowed = /\.(pdf|docx|txt)$/i.test(file.name);
    if (!allowed) {
      error('Only PDF, DOCX, and TXT files are supported.', 'Upload');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      error('Maximum file size is 25 MB.', 'Upload');
      return;
    }

    setUploading(true);
    setAttachedName(file.name);
    try {
      const doc = await chatApi.upload(target.id, file);
      // Chat uploads are private attachments, not shared /api/v1/documents records.
      // The upload response includes the actual private attachment ingestion result.
      if (doc.ingestionStatus !== 'INDEXED') {
        throw new Error(doc.ingestionError || 'Document indexing failed. Please try another file.');
      }
      success(`${file.name} is indexed and ready for questions.`, 'Document Ready');
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to upload the document.', 'Upload');
      setAttachedName('');
    } finally {
      setUploading(false);
    }
  };

  const openSourceDocument = async (
    citation: ChatCitation,
    citationsList: ChatCitation[]
  ) => {
    setSourceCitation(citation);
    setCurrentCitationsList(citationsList);
    setActiveMessageCitations(null);
    try {
      const docSource = await chatApi.source(citation.documentId);
      setSource(docSource);
    } catch {
      setSourceCitation(null);
      error('Unable to open the source document.', 'Source');
    }
  };

  const handleSelectCitationInViewer = async (newCitation: ChatCitation) => {
    setSourceCitation(newCitation);
    if (!source || source.documentId !== newCitation.documentId) {
      try {
        const docSource = await chatApi.source(newCitation.documentId);
        setSource(docSource);
      } catch {
        error('Unable to load citation document.', 'Source');
      }
    }
  };

  const suggestedQuestions = [
    {
      title: 'Analyze Leave & Absence Policies',
      prompt: 'What are the organization policies regarding annual leave, sick days, and notice periods?',
    },
    {
      title: 'Information Security & Data Protection',
      prompt: 'What are the required compliance and data security practices for company devices and access?',
    },
    {
      title: 'Project Onboarding Guidelines',
      prompt: 'Can you summarize the recommended developer onboarding steps and key document references?',
    },
    {
      title: 'Document Summary & Key Highlights',
      prompt: 'Please provide a comprehensive summary of the latest approved organizational documents.',
    },
  ];

  return (
    <div className="h-screen w-screen bg-[#000000] text-slate-100 flex overflow-hidden font-sans select-none">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ChatGPT-Style Sidebar */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col bg-[#09090b] border-r border-[#1f1f1f] transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-72 lg:w-72' : 'w-0 lg:w-0 border-r-0'
        } ${
          mobileSidebarOpen
            ? 'translate-x-0 w-72'
            : '-translate-x-full lg:translate-x-0'
        } overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-[#1f1f1f] flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={newChat}
            className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#141416] hover:bg-[#1c1c1f] text-slate-200 hover:text-white border border-[#27272a] text-xs font-medium transition-all cursor-pointer shadow-xs group"
          >
            <Plus className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>New Chat</span>
          </button>

          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileSidebarOpen(false);
              } else {
                toggleSidebar();
              }
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#18181b] border border-transparent hover:border-[#27272a] transition-colors cursor-pointer"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-500">
            Recent Chats
          </div>

          {conversations.map((c) => {
            const isSelected = active?.id === c.id;
            return (
              <div key={c.id} className="relative group">
                <button
                  onClick={() => {
                    setActive(c);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 pr-8 rounded-xl text-xs transition-all cursor-pointer flex flex-col gap-0.5 ${
                    isSelected
                      ? 'bg-[#18181b] text-white border border-[#2e2e32] shadow-xs font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#121214] border border-transparent'
                  }`}
                >
                  <p className="truncate font-medium">{c.title || 'Untitled session'}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {c.messageCount} {c.messageCount === 1 ? 'message' : 'messages'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingConversation(c);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {!conversations.length && (
            <div className="text-center text-xs text-slate-500 py-12 px-4 space-y-2">
              <MessageSquare className="w-6 h-6 mx-auto opacity-30 text-slate-400" />
              <p>No chat history yet.</p>
              <p className="text-[11px] text-slate-600">Start a new conversation to ask questions.</p>
            </div>
          )}
        </div>

        {/* Bottom of Sidebar: "Go Back to Dashboard" & User Context */}
        <div className="p-3 border-t border-[#1f1f1f] bg-[#0c0c0e] shrink-0 space-y-2">
          {/* Go Back to Dashboard Option */}
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 text-xs font-semibold transition-all cursor-pointer group"
          >
            <LayoutDashboard className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Go back to Dashboard</span>
          </button>

          {/* User Profile Card */}
          <div className="pt-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={user?.name} size="sm" status="online" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-slate-500 truncate">{tenant?.name || 'Workspace'}</p>
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-slate-400 font-mono">
              {user?.role}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Chat Page Workspace */}
      <main className="flex-1 min-w-0 flex flex-col h-full bg-[#000000] relative">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-[#1f1f1f] bg-[#000000]/90 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Sidebar Open/Toggle Button */}
            {!isSidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#141416] border border-[#222222] transition-colors cursor-pointer"
                title="Open sidebar"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Open Sidebar Button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#141416] border border-[#222222] transition-colors cursor-pointer"
              title="Open chat menu"
              aria-label="Open chat menu"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            {/* Active Session Info */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 text-indigo-100" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xs sm:text-sm font-semibold text-white truncate">
                    {active?.title || 'Knowledge Assistant'}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.2 rounded-full">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Grounded RAG
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate hidden sm:block">
                  Strict multi-tenant security · Verified cited evidence
                </p>
              </div>
            </div>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={newChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141416] hover:bg-[#1c1c1f] text-slate-300 hover:text-white border border-[#27272a] text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">New</span>
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e0e10] hover:bg-[#161619] text-slate-300 hover:text-indigo-400 border border-[#222222] text-xs font-medium transition-colors cursor-pointer"
              title="Return to organization dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Dashboard</span>
            </button>
          </div>
        </header>

        {/* Message Thread Scroll View */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6"
        >
          <div className="max-w-3xl mx-auto space-y-6">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-24 text-xs text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2.5 text-indigo-500" />
                Retrieving conversation stream...
              </div>
            ) : messages.length ? (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3.5 ${
                    m.role === 'USER' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {m.role === 'ASSISTANT' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-indigo-400/20">
                      <Sparkles className="w-4 h-4 text-indigo-100" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl ${
                      m.role === 'USER'
                        ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-md selection:bg-indigo-700'
                        : 'min-w-0 flex-1'
                    }`}
                  >
                    {m.role === 'USER' ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                    ) : (
                      <div className="space-y-3">
                        {/* Assistant Response Box */}
                        <div className="bg-[#09090b] border border-[#1f1f1f] rounded-2xl p-4 sm:p-5 shadow-xs text-slate-100">
                          {m.content ? (
                            <MarkdownRenderer content={m.content} />
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                              <span>Searching indexed chunks and synthesizing response...</span>
                            </div>
                          )}
                        </div>

                        {/* Compact source capsule opens the complete evidence list */}
                        {m.citations && m.citations.length > 0 && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setActiveMessageCitations(m.citations)}
                              className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:border-indigo-400/60 hover:bg-indigo-500/15 transition-colors cursor-pointer"
                              aria-label={`Show all ${m.citations.length} sources`}
                            >
                              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Sources</span>
                              <span className="rounded-full bg-indigo-400/15 px-1.5 py-0.5 text-[10px] tabular-nums text-indigo-200">
                                {m.citations.length}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              /* ChatGPT-Style Empty Hero View */
              <div className="py-12 sm:py-20 flex flex-col items-center text-center space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-300/30">
                  <Sparkles className="w-7 h-7" />
                </div>

                <div className="max-w-md space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    How can I assist you today?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Ask questions grounded in your organization’s uploaded documents, policies, and
                    internal knowledge base.
                  </p>
                </div>

                {/* Prompt Suggestion Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl pt-4">
                  {suggestedQuestions.map((sq, i) => (
                    <button
                      key={i}
                      onClick={() => send(sq.prompt)}
                      className="p-3.5 rounded-xl border border-[#1f1f1f] bg-[#09090b] hover:bg-[#121214] hover:border-indigo-500/50 text-left transition-all cursor-pointer group shadow-2xs"
                    >
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-indigo-400">
                        {sq.title}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {sq.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ChatGPT-Style Sticky Composer Input */}
        <div className="p-4 border-t border-[#1f1f1f] bg-[#000000] shrink-0">
          <div className="max-w-3xl mx-auto space-y-2">
            {attachedName && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#141416] border border-[#27272a] text-xs text-slate-300">
                <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-medium truncate max-w-xs">{attachedName}</span>
                <span className="text-[10px] text-slate-500">
                  {uploading ? '· vectorizing chunks...' : '· indexed into session'}
                </span>
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-[#262626] bg-[#0d0d0f] p-2.5 shadow-lg focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                  e.currentTarget.value = '';
                }}
              />

              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#18181b] border border-transparent disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                title="Attach private PDF/DOCX for this session"
                aria-label="Attach file"
              >
                <FileUp className="w-4 h-4" />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Message Enterprise Knowledge Assistant..."
                className="flex-1 resize-none outline-none text-xs sm:text-sm px-1 py-1.5 max-h-36 bg-transparent text-slate-100 placeholder:text-slate-500 leading-relaxed font-sans"
              />

              <button
                type="button"
                disabled={!input.trim() || loading || uploading}
                onClick={() => send()}
                aria-label="Send query"
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white transition-all cursor-pointer shadow-sm shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 pt-0.5">
              <span>Answers are strictly grounded in indexed organization documents.</span>
              <span className="hidden sm:inline">Zero Hallucinations Guarantee</span>
            </div>
          </div>
        </div>
      </main>

      {/* Sources list modal */}
      <SourcesModal
        isOpen={!!activeMessageCitations}
        citations={activeMessageCitations || []}
        onClose={() => setActiveMessageCitations(null)}
        onSelectCitation={(c) => openSourceDocument(c, activeMessageCitations || [])}
      />

      {/* Evidence Document Viewer */}
      <SourceViewer
        citation={sourceCitation}
        allCitations={currentCitationsList}
        source={source}
        onSelectCitation={handleSelectCitationInViewer}
        onClose={() => {
          setSourceCitation(null);
          setSource(null);
        }}
      />

      {/* Delete Conversation Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingConversation}
        title="Delete Conversation"
        message={`Delete conversation "${deletingConversation?.title || 'this session'}"? All chat history and private attachments in this session will be permanently removed.`}
        confirmText="Delete Conversation"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingConversation(null)}
      />
    </div>
  );
};
