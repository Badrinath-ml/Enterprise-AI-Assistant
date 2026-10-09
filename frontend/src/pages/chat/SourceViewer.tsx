import React, { useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FileType2,
  Hash,
  Sparkles,
  Target,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { ChatCitation, ChatSource } from '../../types/chat';

interface Props {
  citation: ChatCitation | null;
  allCitations?: ChatCitation[];
  source: ChatSource | null;
  onSelectCitation?: (citation: ChatCitation) => void;
  onClose: () => void;
}

export const SourceViewer: React.FC<Props> = ({
  citation,
  allCitations = [],
  source,
  onSelectCitation,
  onClose,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Clean and find best highlight match
  const highlightResult = useMemo(() => {
    if (!citation || !source || !source.text) {
      return { before: '', match: '', after: '', found: false };
    }

    const docText = source.text;
    const rawSnippet = citation.snippet || '';

    // Strip leading/trailing ellipsis, quotes, or markdown
    const cleanSnippet = rawSnippet
      .replace(/^[\s…"'.*#>-]+/, '')
      .replace(/[\s…"'.*#>-]+$/, '')
      .trim();

    if (!cleanSnippet) {
      return { before: docText, match: '', after: '', found: false };
    }

    // 1. Direct case-insensitive match
    const lowerDoc = docText.toLowerCase();
    const lowerNeedle = cleanSnippet.toLowerCase();
    let matchIndex = lowerDoc.indexOf(lowerNeedle);
    let matchLength = cleanSnippet.length;

    // 2. Fallback: match by first significant sentence or phrase (>= 25 chars)
    if (matchIndex < 0) {
      const sentences = cleanSnippet
        .split(/[.\n;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 25);

      for (const sentence of sentences) {
        const idx = lowerDoc.indexOf(sentence.toLowerCase());
        if (idx >= 0) {
          matchIndex = idx;
          matchLength = sentence.length;
          break;
        }
      }
    }

    // 3. Fallback: match normalized whitespace
    if (matchIndex < 0) {
      const normalizedNeedle = cleanSnippet.replace(/\s+/g, ' ');
      const sample = normalizedNeedle.slice(0, 40);
      const idx = lowerDoc.indexOf(sample.toLowerCase());
      if (idx >= 0) {
        matchIndex = idx;
        matchLength = Math.min(cleanSnippet.length, docText.length - idx);
      }
    }

    if (matchIndex >= 0) {
      return {
        before: docText.slice(0, matchIndex),
        match: docText.slice(matchIndex, matchIndex + matchLength),
        after: docText.slice(matchIndex + matchLength),
        found: true,
      };
    }

    return { before: docText, match: '', after: '', found: false };
  }, [citation, source]);

  useEffect(() => {
    if (highlightResult.found) {
      const timer = setTimeout(() => {
        const el = document.getElementById('active-source-highlight');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightResult.found, citation?.id]);

  const scrollToHighlight = () => {
    const el = document.getElementById('active-source-highlight');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (!citation || !source) return null;

  const isPdf =
    source.mimeType === 'application/pdf' ||
    source.fileName.toLowerCase().endsWith('.pdf');

  const currentIndex = allCitations.findIndex(
    (c) =>
      c.id === citation.id ||
      (c.documentId === citation.documentId && c.chunkId === citation.chunkId)
  );
  const hasMultiple = allCitations.length > 1;

  return (
    <Modal
      isOpen={!!citation && !!source}
      onClose={onClose}
      title={source.title || source.fileName}
      description={`${source.fileName} · v${source.version}`}
      size="xl"
    >
      <div className="flex flex-col h-[70vh] -mt-2">
        {/* Document toolbar */}
        <div className="p-3 bg-slate-50 dark:bg-[#0c121e] border border-slate-200 dark:border-[#1f2d44] rounded-xl mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white dark:bg-[#182338] border border-slate-200 dark:border-[#22314a] text-slate-700 dark:text-slate-300 shadow-2xs">
              {isPdf ? (
                <FileType2 className="w-4 h-4 text-rose-500" />
              ) : (
                <FileText className="w-4 h-4 text-indigo-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {source.fileName}
                </span>
                {citation.pageNumber && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                    <Hash className="w-2.5 h-2.5" /> Page {citation.pageNumber}
                  </span>
                )}
                <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                  {Math.round(citation.confidence * 100)}% Match
                </span>
              </div>
            </div>
          </div>

          {hasMultiple && onSelectCitation && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mr-1">
                Citation {currentIndex >= 0 ? currentIndex + 1 : 1} of {allCitations.length}
              </span>
              <button
                type="button"
                disabled={currentIndex <= 0}
                onClick={() => {
                  if (currentIndex > 0) onSelectCitation(allCitations[currentIndex - 1]);
                }}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1f2d44] bg-white dark:bg-[#182338] hover:bg-slate-100 dark:hover:bg-[#202f4a] disabled:opacity-40 text-slate-600 dark:text-slate-400 cursor-pointer"
                title="Previous citation"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={currentIndex < 0 || currentIndex >= allCitations.length - 1}
                onClick={() => {
                  if (currentIndex < allCitations.length - 1)
                    onSelectCitation(allCitations[currentIndex + 1]);
                }}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1f2d44] bg-white dark:bg-[#182338] hover:bg-slate-100 dark:hover:bg-[#202f4a] disabled:opacity-40 text-slate-600 dark:text-slate-400 cursor-pointer"
                title="Next citation"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Retrieved snippet banner */}
        <div className="mb-3 px-3.5 py-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-start justify-between gap-3 shadow-2xs">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-300 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Retrieved Evidence Point
            </div>
            <p className="text-xs text-amber-950 dark:text-amber-200 font-sans leading-relaxed line-clamp-2">
              "{citation.snippet}"
            </p>
          </div>
          {highlightResult.found && (
            <button
              type="button"
              onClick={scrollToHighlight}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-200/70 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-900 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800 transition-colors cursor-pointer"
            >
              <Target className="w-3 h-3" />
              Jump to Highlight
            </button>
          )}
        </div>

        {/* Document content viewer with highlighted passage */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#1f1f1f] bg-white dark:bg-[#000000] p-5 text-sm font-sans leading-7 text-slate-800 dark:text-slate-200 shadow-2xs relative"
        >
          {highlightResult.found ? (
            <div className="whitespace-pre-wrap">
              {highlightResult.before}
              <mark
                id="active-source-highlight"
                className="bg-amber-300 dark:bg-amber-500/30 text-slate-950 dark:text-amber-100 px-1 py-0.5 rounded font-semibold border-b-2 border-amber-500 shadow-xs ring-2 ring-amber-400/40"
              >
                {highlightResult.match}
              </mark>
              {highlightResult.after}
            </div>
          ) : (
            <div>
              <div className="mb-4 p-2.5 rounded-lg bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] text-xs text-slate-600 dark:text-slate-400">
                <span>Normalized document text rendered below:</span>
              </div>
              <div className="whitespace-pre-wrap">{source.text}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
