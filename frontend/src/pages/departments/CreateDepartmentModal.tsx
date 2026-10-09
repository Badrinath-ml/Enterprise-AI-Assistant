import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { departmentApi } from '../../api/departments';
import { DepartmentResponse } from '../../types/department';
import { useToast } from '../../hooks/useToast';
import { ApiError } from '../../types/api';
import { dataSync } from '../../utils/dataSync';

interface CreateDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (dept: DepartmentResponse) => void;
}

export const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { success, error: toastError } = useToast();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Department name is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const created = await departmentApi.createDepartment({ name: name.trim() });
      success(`Department "${created.name}" created successfully.`, 'Department Created');
      dataSync.notify('departments');
      onCreated(created);
      setName('');
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Failed to create department';
      setError(msg);
      toastError(msg, 'Creation Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Department"
      description="Add a department to organize people and document access in your organization."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!name.trim()}
          >
            Create Department
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        <Input
          label="Department Name"
          placeholder="e.g. Engineering, Product, Human Resources"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          required
          autoFocus
        />
      </form>
    </Modal>
  );
};
