import React, { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { documentApi } from '../../api/documents';
import { DocumentResponse } from '../../types/document';
import { useToast } from '../../hooks/useToast';
import { dataSync } from '../../utils/dataSync';

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
    if (!document || !file) {
      error('Select a replacement file.', 'File required');
      return;
    }
    setSaving(true);
    try {
      await documentApi.replaceContent(document.id, file);
      success('Document content replaced.', 'New Version Created');
      dataSync.notify('documents');
      onClose();
      onUpdated();
      setFile(null);
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to replace document.', 'Replacement Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Replace Document Content"
      description={
        document
          ? `This will atomically create version ${document.version + 1} of "${document.title}" and re-queue vector ingestion.`
          : ''
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            New Document File <span className="text-rose-500">*</span>
          </label>
          <input
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-[#182338] file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 dark:hover:file:bg-[#202f4a] cursor-pointer"
          />
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            PDF, DOCX, or TXT · Maximum 25 MB
          </p>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-[#1f2d44]">
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={saving} leftIcon={<FileUp className="w-4 h-4" />}>
            Upload Version {document ? document.version + 1 : ''}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
