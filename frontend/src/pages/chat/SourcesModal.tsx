import React from 'react';
import { ExternalLink, FileText, FileType2, Hash } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { ChatCitation } from '../../types/chat';

interface SourcesModalProps {
  isOpen: boolean;
  citations: ChatCitation[];
  onClose: () => void;
  onSelectCitation: (citation: ChatCitation) => void;
}

const formatConfidence = (value: number) => `${Math.round(value * 100)}% Match`;

export const SourcesModal: React.FC<SourcesModalProps> = ({
  isOpen,
  citations,
  onClose,
  onSelectCitation,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Retrieved Sources & Evidence"
      description={`${citations.length} ${citations.length === 1 ? 'source' : 'sources'} grounded this response`}
      size="lg"
    >
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {citations.map((c, index) => {
          const isPdf = c.fileName.toLowerCase().endsWith('.pdf');

          return (
            <div
              key={c.id || index}
              onClick={() => onSelectCitation(c)}
              className="group p-3.5 rounded-xl border border-slate-200 dark:border-[#1f1f1f] bg-white dark:bg-[#0a0a0a] hover:bg-slate-50/80 dark:hover:bg-[#141416] hover:border-slate-300 dark:hover:border-[#27272a] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#18181b] text-slate-700 dark:text-slate-300 shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/60 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors border border-slate-200 dark:border-[#27272a]">
                    {isPdf ? <FileType2 className="w-4 h-4 text-rose-500" /> : <FileText className="w-4 h-4 text-indigo-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {c.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="truncate max-w-[200px]">{c.fileName}</span>
                      {c.pageNumber && (
                        <span className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-[#18181b] px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300 font-medium border border-slate-200 dark:border-[#27272a]">
                          <Hash className="w-2.5 h-2.5" /> Page {c.pageNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    {formatConfidence(c.confidence)}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>

              {/* Snippet quote */}
              <div className="mt-2.5 bg-slate-50/80 dark:bg-[#070707] rounded-xl p-3 border-l-2 border-indigo-500 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans line-clamp-3">
                "{c.snippet}"
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-[#1f1f1f]">
                <span className="text-slate-400 dark:text-slate-500 text-[10px]">Citation #{index + 1}</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline inline-flex items-center gap-1">
                  View in document & highlights →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
