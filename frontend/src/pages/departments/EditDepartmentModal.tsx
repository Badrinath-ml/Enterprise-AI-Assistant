import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { departmentApi } from '../../api/departments';
import { DepartmentResponse } from '../../types/department';
import { useToast } from '../../hooks/useToast';
import { ApiError } from '../../types/api';
import { dataSync } from '../../utils/dataSync';

interface Props {
  isOpen: boolean;
  department: DepartmentResponse | null;
  onClose: () => void;
  onUpdated: (department: DepartmentResponse) => void;
}

export const EditDepartmentModal: React.FC<Props> = ({
  isOpen,
  department,
  onClose,
  onUpdated,
}) => {
  const { success, error: toastError } = useToast();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && department) {
      setName(department.name);
      setError(null);
    }
  }, [isOpen, department]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department) return;
    if (!name.trim()) return setError('Department name is required');
    setLoading(true);
    setError(null);
    try {
      const updated = await departmentApi.updateDepartment(department.id, {
        name: name.trim(),
      });
      success(`Department "${updated.name}" updated successfully.`, 'Department Updated');
      dataSync.notify('departments');
      onUpdated(updated);
      onClose();
    } catch (err) {
      const e = err as ApiError;
      const msg = e.message || 'Failed to update department.';
      setError(msg);
      toastError(msg, 'Update Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Department"
      description="Rename this department without altering assigned members."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            isLoading={loading}
            disabled={!name.trim()}
          >
            Save Changes
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        <Input
          label="Department Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          required
          autoFocus
        />
      </form>
    </Modal>
  );
};