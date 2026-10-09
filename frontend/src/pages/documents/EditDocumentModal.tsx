import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { documentApi } from '../../api/documents';
import { DocumentResponse, DocumentStatus } from '../../types/document';
import { DepartmentResponse } from '../../types/department';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataSync } from '../../utils/dataSync';

export const EditDocumentModal: React.FC<{
  isOpen: boolean;
  document: DocumentResponse | null;
  departments: DepartmentResponse[];
  onClose: () => void;
  onUpdated: () => void;
}> = ({ isOpen, document, departments, onClose, onUpdated }) => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<DocumentStatus>('DRAFT');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!document) return;
    setTitle(document.title);
    setDescription(document.description || '');
    setDepartmentId(document.departmentId || '');
    setStatus(document.status);
  }, [document]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;
    setSaving(true);
    try {
      await documentApi.update(document.id, {
        title,
        description,
        departmentId: departmentId || null,
        status,
      });
      success('Document details updated.', 'Document Updated');
      dataSync.notify('documents');
      onUpdated();
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to update document.', 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const options = [
    { value: '', label: 'Organization-wide' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Document"
      description="Update metadata, department assignment, or lifecycle status."
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Document description"
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

        <Select
          label="Lifecycle Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as DocumentStatus)}
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'PENDING_REVIEW', label: 'Pending review' },
            { value: 'APPROVED', label: 'Approved (Available for AI Chat)' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'ARCHIVED', label: 'Archived' },
          ]}
        />

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-[#1f2d44]">
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={saving}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
