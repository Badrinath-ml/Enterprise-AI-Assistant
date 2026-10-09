import React, { useEffect, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { useToast } from '../../hooks/useToast';
import { documentApi } from '../../api/documents';
import { DepartmentResponse } from '../../types/department';
import { useAuth } from '../../hooks/useAuth';
import { dataSync } from '../../utils/dataSync';

export const UploadDocumentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentResponse[];
  onUploaded: () => void;
}> = ({ isOpen, onClose, departments, onUploaded }) => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setTitle('');
    setDescription('');
    setDepartmentId(user?.role === 'MANAGER' ? user.departmentId || '' : '');
  }, [isOpen, user?.role, user?.departmentId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      error('Select a PDF, DOCX, or TXT file.', 'File required');
      return;
    }
    setSaving(true);
    try {
      await documentApi.upload(file, title, description, departmentId || null);
      success('Document uploaded successfully.', 'Document Uploaded');
      dataSync.notify('documents');
      onClose();
      onUploaded();
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to upload document.', 'Upload Failed');
    } finally {
      setSaving(false);
    }
  };

  const options = [
    { value: '', label: 'Organization-wide' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Knowledge Document"
      description="Add documentation to your organization's verified workspace."
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Document File <span className="text-rose-500">*</span>
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

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional title (defaults to filename)"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Brief description of the document contents"
            className="w-full rounded-lg border border-slate-300 dark:border-[#22314a] bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <Select
          label="Department Scope"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          disabled={!isAdmin}
          options={options}
        />

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-[#1f2d44]">
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={saving}
            leftIcon={<FileUp className="w-4 h-4" />}
          >
            Upload Document
          </Button>
        </div>
      </form>
    </Modal>
  );
};
