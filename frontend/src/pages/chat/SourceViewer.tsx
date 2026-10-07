import React, { useMemo } from 'react';
import { FileText, FileType2, Hash } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { ChatCitation, ChatSource } from '../../types/chat';

interface Props {
  citation: ChatCitation | null;
  source: ChatSource | null;
  onClose: () => void;
}

export const SourceViewer: React.FC<Props> = ({ citation, source, onClose }) => {
  const parts = useMemo(() => {
    if (!citation || !source) return null;
    const needle = citation.snippet.trim();
    if (!needle) return { before: source.text, match: '', after: '' };
    const index = source.text.toLowerCase().indexOf(needle.toLowerCase());
    if (index < 0) return { before: source.text, match: '', after: '' };
    return {
      before: source.text.slice(0, index),
      match: source.text.slice(index, index + needle.length),
      after: source.text.slice(index + needle.length),
    };
  }, [citation, source]);

  if (!citation || !source) return null;

  const isPdf = source.mimeType === 'application/pdf';
  const isDocx = source.mimeType.includes('wordprocessingml');

  return (
    <Modal isOpen={!!citation && !!source} onClose={onClose}
      title={source.title} description={`${source.fileName} · v${source.version}`} size="xl">
      <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
        {isPdf ? <FileType2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
        <span>{isPdf ? 'PDF source' : isDocx ? 'DOCX source' : 'Text source'}</span>
        {citation.pageNumber && <span className="ml-auto inline-flex items-center gap-1"><Hash className="w-3 h-3" />Page {citation.pageNumber}</span>}
      </div>
      <div className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">
          {parts?.before}
          {parts?.match ? <mark className="rounded bg-yellow-200 px-1 py-0.5 text-slate-950">{parts.match}</mark> : null}
          {parts?.after}
        </pre>
      </div>
      {!parts?.match && <p className="mt-2 text-[11px] text-amber-600">The stored chunk text was normalized during ingestion, so an exact text span was not found in the extracted source.</p>}
    </Modal>
  );
};
