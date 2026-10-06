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
      await documentApi.update(document.id, { title, description, departmentId: departmentId || null, status });
      success('Document details updated.', 'Document Updated');
      onUpdated();
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to update document.', 'Update Failed');
    } finally { setSaving(false); }
  };

  const isAdmin = user?.role === 'ADMIN';
  const options = [{ value: '', label: 'Organization-wide' }, ...departments.map(d => ({ value: d.id, label: d.name }))];

  return <Modal isOpen={isOpen} onClose={onClose} title="Edit document" description="Update metadata, department, or workflow status.">
    <form onSubmit={submit} className="space-y-4">
      <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} required />
      <div><label className="block text-xs font-medium text-slate-700 mb-1.5">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-200" /></div>
      <Select label="Department" value={departmentId} onChange={e => setDepartmentId(e.target.value)} disabled={!isAdmin} options={options} />
      <Select label="Status" value={status} onChange={e => setStatus(e.target.value as DocumentStatus)} options={[
        { value: 'DRAFT', label: 'Draft' },
        { value: 'PENDING_REVIEW', label: 'Pending review' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'ARCHIVED', label: 'Archived' },
      ]} />
      <div className="flex justify-end gap-2 pt-2"><Button variant="outline" type="button" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" loading={saving}>Save changes</Button></div>
    </form>
  </Modal>;
};
