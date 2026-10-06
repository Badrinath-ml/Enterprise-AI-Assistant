import React, { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { documentApi } from '../../api/documents';
import { DocumentResponse } from '../../types/document';
import { useToast } from '../../hooks/useToast';

export const ReplaceDocumentModal: React.FC<{
  isOpen: boolean;
  document: DocumentResponse | null;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ isOpen, document, onClose, onUpdated }) => {
  const { success, error } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document || !file) { error('Select a replacement file.', 'File required'); return; }
    setSaving(true);
    try {
      await documentApi.replaceContent(document.id, file);
      success('Document content replaced.', 'New Version Created');
      onClose();
      onUpdated();
      setFile(null);
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to replace document.', 'Replacement Failed');
    } finally { setSaving(false); }
  };

  return <Modal isOpen={isOpen} onClose={onClose} title="Replace document" description={document ? `This will create version ${document.version + 1} of ${document.title}.` : ''}>
    <form onSubmit={submit} className="space-y-4">
      <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700" />
      <p className="text-[11px] text-slate-400">PDF, DOCX, or TXT · maximum 25 MB</p>
      <div className="flex justify-end gap-2"><Button variant="outline" type="button" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" isLoading={saving} leftIcon={<FileUp className="w-4 h-4"/>}>Replace</Button></div>
    </form>
  </Modal>;
};
