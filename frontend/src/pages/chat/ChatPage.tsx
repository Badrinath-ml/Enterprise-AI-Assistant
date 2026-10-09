import React, { useEffect, useRef, useState } from 'react';
import { FileUp, Plus, Send, Sparkles, User, Paperclip, Loader2, ChevronLeft, BookOpen, Trash2 } from 'lucide-react';
import { chatApi } from '../../api/chat';
import { ChatCitation, ChatConversation, ChatMessage, ChatSource } from '../../types/chat';
import { useToast } from '../../hooks/useToast';
import { SourceViewer } from './SourceViewer';
import { SourcesModal } from './SourcesModal';
import { MarkdownRenderer } from '../../components/chat/MarkdownRenderer';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

const ACTIVE_CHAT_KEY = 'eka.activeChatId';

export const ChatPage: React.FC = () => {
  const { error, success } = useToast();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachedName, setAttachedName] = useState('');

  // Sources modal and Document Viewer state
  const [activeMessageCitations, setActiveMessageCitations] = useState<ChatCitation[] | null>(null);
  const [currentCitationsList, setCurrentCitationsList] = useState<ChatCitation[]>([]);
  const [sourceCitation, setSourceCitation] = useState<ChatCitation | null>(null);
  const [source, setSource] = useState<ChatSource | null>(null);

  // In-app conversation deletion state
  const [deletingConversation, setDeletingConversation] = useState<ChatConversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [mobileHistory, setMobileHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConversations = async () => {
    try {
      const items = await chatApi.getConversations();
      setConversations(items);
      const savedId = sessionStorage.getItem(ACTIVE_CHAT_KEY);
      const saved = savedId ? items.find(c => c.id === savedId) : null;
      setActive(prev => prev || saved || items[0] || null);
    } catch {
      error('Unable to load chat history.', 'Chat');
    }
  };

  const loadHistory = async (conversation: ChatConversation) => {
    setLoadingHistory(true);
    try {
      const result = await chatApi.getHistory(conversation.id);
      setMessages(result.messages);
    } catch {
      error('Unable to load this conversation.', 'Chat');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { if (active) { sessionStorage.setItem(ACTIVE_CHAT_KEY, active.id); loadHistory(active); } else { setMessages([]); } }, [active?.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const newChat = async () => {
    try {
      const c = await chatApi.createConversation();
      setConversations(prev => [c, ...prev]);
      setActive(c);
      setMessages([]);
      setMobileHistory(false);
    } catch {
      error('Unable to create a conversation.', 'Chat');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingConversation) return;
    setIsDeleting(true);
    try {
      await chatApi.deleteConversation(deletingConversation.id);
      setConversations(prev => prev.filter(c => c.id !== deletingConversation.id));
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

  const send = async () => {
    const value = input.trim();
    if (!value || !active || loading) return;

    setInput('');
    setLoading(true);

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

    setMessages(prev => [...prev, userMessage, assistantMessage]);

    try {
      await chatApi.stream(
        active.id,
        value,
        token => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + token } : m
          ));
        },
        citation => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId && !m.citations.some(c => c.id === citation.id)
              ? { ...m, citations: [...m.citations, citation] }
              : m
          ));
        }
      );

      // Server is the source of truth: reload the persisted turn, citations and history.
      await loadHistory(active);
      await loadConversations();
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== assistantId && m.id !== userMessage.id));
      error((e as { message?: string }).message || 'Unable to generate an answer.', 'Assistant');
    } finally {
      setLoading(false);
    }
  };

  const upload = async (file: File) => {
    if (!active) return;
    const allowed = /\.(pdf|docx|txt)$/i.test(file.name);
    if (!allowed) { error('Only PDF, DOCX, and TXT files are supported.', 'Upload'); return; }
    if (file.size > 25 * 1024 * 1024) { error('Maximum file size is 25 MB.', 'Upload'); return; }
    setUploading(true);
    setAttachedName(file.name);
    try {
      const doc = await chatApi.upload(active.id, file);
      let ready = false;
      for (let i = 0; i < 30; i++) {
        const status = await chatApi.ingestion(doc.id);
        if (status.ingestionStatus === 'INDEXED') { ready = true; break; }
        if (status.ingestionStatus === 'FAILED') throw new Error(status.ingestionError || 'Document indexing failed');
        await new Promise(r => setTimeout(r, 1000));
      }
      if (!ready) throw new Error('Document is still indexing. Please wait a little and try again.');
      success(`${file.name} is ready for questions.`, 'Document ready');
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to upload the document.', 'Upload');
      setAttachedName('');
    } finally {
      setUploading(false);
    }
  };

  const openSourceDocument = async (citation: ChatCitation, citationsList: ChatCitation[]) => {
    setSourceCitation(citation);
    setCurrentCitationsList(citationsList);
    setActiveMessageCitations(null); // Close the intermediate modal if open
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
    // If the citation points to a different document, load its text
    if (!source || source.documentId !== newCitation.documentId) {
      try {
        const docSource = await chatApi.source(newCitation.documentId);
        setSource(docSource);
      } catch {
        error('Unable to load citation document.', 'Source');
      }
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[620px] bg-white border border-slate-200 rounded-xl overflow-hidden flex shadow-xs">
      <aside className={`w-64 bg-slate-50 border-r border-slate-200 flex-col ${mobileHistory ? 'flex' : 'hidden'} lg:flex`}>
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div><p className="text-xs font-semibold text-slate-900">Chat history</p><p className="text-[10px] text-slate-400">Your conversations</p></div>
          <button onClick={newChat} className="p-1.5 rounded-md hover:bg-white text-slate-600 transition-colors" title="New chat"><Plus className="w-4 h-4"/></button>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto flex-1">
          {conversations.map(c => (
            <div key={c.id} className="relative group">
              <button onClick={() => { setActive(c); setMobileHistory(false); }}
                className={`w-full text-left px-3 py-2.5 pr-8 rounded-lg text-xs transition-colors ${active?.id === c.id ? 'bg-white border border-slate-200 shadow-xs text-slate-900' : 'text-slate-600 hover:bg-white'}`}>
                <p className="font-medium truncate">{c.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{c.messageCount} messages</p>
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setDeletingConversation(c);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                title="Delete conversation">
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
          ))}
          {!conversations.length && <div className="text-center text-[11px] text-slate-400 py-10">No conversations yet.</div>}
        </div>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col">
        <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMobileHistory(v => !v)} className="lg:hidden p-1.5 rounded hover:bg-slate-100"><ChevronLeft className="w-4 h-4"/></button>
            <Sparkles className="w-4 h-4 text-slate-700"/>
            <span className="text-xs font-semibold truncate">{active?.title || 'Enterprise Assistant'}</span>
          </div>
          <button onClick={newChat} className="lg:hidden text-xs text-slate-600">New chat</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
          {!active ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center"><Sparkles className="w-6 h-6"/></div>
              <h1 className="mt-4 text-xl font-semibold text-slate-900">Ask your organization</h1>
              <p className="mt-2 max-w-md text-sm text-slate-500">Ask questions about approved enterprise documents and get grounded answers with source evidence.</p>
              <button onClick={newChat} className="mt-5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium">Start a new chat</button>
            </div>
          ) : loadingHistory ? (
            <div className="flex items-center justify-center h-full text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin mr-2"/>Loading conversation...</div>
          ) : messages.length ? (
            messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'ASSISTANT' && <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5"><Sparkles className="w-3.5 h-3.5"/></div>}
                <div className={`max-w-3xl ${m.role === 'USER' ? 'bg-slate-900 text-white rounded-2xl rounded-br-md px-4 py-3' : 'min-w-0'}`}>
                  {m.role === 'USER' ? (
                    <div className="whitespace-pre-wrap text-sm leading-6">{m.content}</div>
                  ) : (
                    <>
                      <MarkdownRenderer content={m.content} />
                      {m.citations && m.citations.length > 0 && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setActiveMessageCitations(m.citations)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200/90 text-slate-700 border border-slate-200/80 transition-all hover:shadow-2xs group cursor-pointer"
                            title="Click to view all retrieved sources & evidence"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-105 transition-transform" />
                            <span className="font-semibold text-slate-800">
                              {m.citations.length} {m.citations.length === 1 ? 'Source' : 'Sources'}
                            </span>
                            <span className="text-[10px] text-slate-400 group-hover:text-slate-600 font-normal">
                              · View evidence
                            </span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {m.role === 'USER' && <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5"><User className="w-3.5 h-3.5"/></div>}
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-10">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 mb-3">
                <Sparkles className="w-5 h-5"/>
              </div>
              <p className="text-base font-semibold text-slate-900">What would you like to know?</p>
              <p className="text-xs text-slate-500 mt-1">Ask questions about approved organization documents to receive grounded answers with citations.</p>
              <div className="mt-6 flex flex-col sm:flex-row gap-2 w-full justify-center">
                {[
                  "What are our security and data privacy policies?",
                  "What is the document approval process?",
                  "Summarize key operational guidelines."
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setInput(suggestion); }}
                    className="text-left text-xs p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-colors shadow-xs"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {loading && <div className="flex items-center gap-2 text-xs text-slate-400"><Sparkles className="w-4 h-4"/>Thinking...</div>}
          <div ref={bottomRef}/>
        </div>

        <div className="p-3 sm:p-4 border-t border-slate-200">
          {attachedName && <div className="mb-2 text-[11px] text-slate-500 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5"/>{attachedName}{uploading ? ' · indexing...' : ' · ready'}</div>}
          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-xs focus-within:ring-2 focus-within:ring-slate-200">
            <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={e => { const file = e.target.files?.[0]; if (file) upload(file); e.currentTarget.value = ''; }} />
            <button disabled={!active || uploading} onClick={() => fileRef.current?.click()} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40" title="Attach document"><FileUp className="w-4 h-4"/></button>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1} placeholder="Ask about your enterprise knowledge..." className="flex-1 resize-none outline-none text-sm px-1 py-2 max-h-32 bg-transparent" />
            <button disabled={!input.trim() || !active || loading || uploading} onClick={send} className="p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"><Send className="w-4 h-4"/></button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">Grounded answers only · Sources capsule opens evidence · Enter to send · Shift+Enter for a new line</p>
        </div>
      </section>

      {/* Sources list modal (opened from the capsule) */}
      <SourcesModal
        isOpen={!!activeMessageCitations}
        citations={activeMessageCitations || []}
        onClose={() => setActiveMessageCitations(null)}
        onSelectCitation={c => openSourceDocument(c, activeMessageCitations || [])}
      />

      {/* Document interface with highlighted answers and citation navigation */}
      <SourceViewer
        citation={sourceCitation}
        allCitations={currentCitationsList}
        source={source}
        onSelectCitation={handleSelectCitationInViewer}
        onClose={() => { setSourceCitation(null); setSource(null); }}
      />

      {/* In-app confirmation dialog for deleting conversations */}
      <ConfirmDialog
        isOpen={!!deletingConversation}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${deletingConversation?.title || 'this chat'}"? All chat history and private attachments will be permanently removed.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingConversation(null)}
      />
    </div>
  );
};
