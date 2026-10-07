import React, { useEffect, useRef, useState } from 'react';
import { FileUp, Plus, Send, Sparkles, User, Paperclip, Loader2, ChevronLeft, BookOpen } from 'lucide-react';
import { chatApi } from '../../api/chat';
import { ChatCitation, ChatConversation, ChatMessage, ChatSource } from '../../types/chat';
import { useToast } from '../../hooks/useToast';
import { SourceViewer } from './SourceViewer';

const formatConfidence = (value: number) => `${Math.round(value * 100)}%`;

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
  const [sourceCitation, setSourceCitation] = useState<ChatCitation | null>(null);
  const [source, setSource] = useState<ChatSource | null>(null);
  const [mobileHistory, setMobileHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConversations = async () => {
    try {
      const items = await chatApi.getConversations();
      setConversations(items);
      if (!active && items.length) setActive(items[0]);
    } catch (e) {
      error('Unable to load chat history.', 'Chat');
    }
  };

  const loadHistory = async (conversation: ChatConversation) => {
    setLoadingHistory(true);
    try {
      const result = await chatApi.getHistory(conversation.id);
      setMessages(result.messages);
    } catch (e) {
      error('Unable to load this conversation.', 'Chat');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { if (active) loadHistory(active); else setMessages([]); }, [active?.id]);
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

  const send = async () => {
    const value = input.trim();
    if (!value || !active || loading) return;
    setInput('');
    setLoading(true);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`, role: 'USER', content: value,
      createdAt: new Date().toISOString(), citations: [],
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const result = await chatApi.send(active.id, value);
      setMessages(prev => [...prev.filter(m => m.id !== optimistic.id), result.userMessage, result.assistantMessage]);
      setConversations(prev => prev.map(c => c.id === active.id
        ? { ...c, title: c.title === 'New conversation' ? value.slice(0, 60) : c.title, messageCount: c.messageCount + 2, updatedAt: new Date().toISOString() }
        : c));
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
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

  const openSource = async (citation: ChatCitation) => {
    setSourceCitation(citation);
    try {
      setSource(await chatApi.source(citation.documentId));
    } catch {
      setSourceCitation(null);
      error('Unable to open the source document.', 'Source');
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[620px] bg-white border border-slate-200 rounded-xl overflow-hidden flex shadow-xs">
      <aside className={`w-64 bg-slate-50 border-r border-slate-200 flex-col ${mobileHistory ? 'flex' : 'hidden'} lg:flex`}>
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div><p className="text-xs font-semibold text-slate-900">Chat history</p><p className="text-[10px] text-slate-400">Your conversations</p></div>
          <button onClick={newChat} className="p-1.5 rounded-md hover:bg-white text-slate-600" title="New chat"><Plus className="w-4 h-4"/></button>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto flex-1">
          {conversations.map(c => (
            <button key={c.id} onClick={() => { setActive(c); setMobileHistory(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${active?.id === c.id ? 'bg-white border border-slate-200 shadow-xs text-slate-900' : 'text-slate-600 hover:bg-white'}`}>
              <p className="font-medium truncate">{c.title}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{c.messageCount} messages</p>
            </button>
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
                {m.role === 'ASSISTANT' && <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0"><Sparkles className="w-3.5 h-3.5"/></div>}
                <div className={`max-w-3xl ${m.role === 'USER' ? 'bg-slate-900 text-white rounded-2xl rounded-br-md px-4 py-3' : 'min-w-0'}`}>
                  <div className="whitespace-pre-wrap text-sm leading-7">{m.content}</div>
                  {m.role === 'ASSISTANT' && m.citations.length > 0 && (
                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 mb-2"><BookOpen className="w-3.5 h-3.5"/> Sources</div>
                      <div className="flex flex-wrap gap-2">
                        {m.citations.map(c => (
                          <button key={c.id} onClick={() => openSource(c)}
                            className="text-left rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 min-w-[210px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-slate-800 truncate">{c.title}</span>
                              <span className="text-[10px] font-semibold text-slate-500">{formatConfidence(c.confidence)}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{c.pageNumber ? `Page ${c.pageNumber} · ` : ''}{c.fileName}</div>
                            <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{c.snippet}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {m.role === 'USER' && <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><User className="w-3.5 h-3.5"/></div>}
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Sparkles className="w-8 h-8 text-slate-300"/>
              <p className="mt-3 text-sm font-medium text-slate-700">What would you like to know?</p>
              <p className="text-xs text-slate-400 mt-1">Ask about your approved organization documents.</p>
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
          <p className="text-[10px] text-slate-400 mt-2 text-center">Grounded answers only · Sources are clickable · Enter to send · Shift+Enter for a new line</p>
        </div>
      </section>

      <SourceViewer citation={sourceCitation} source={source} onClose={() => { setSourceCitation(null); setSource(null); }} />
    </div>
  );
};
