import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { userApi } from '../../api/users';
import { departmentApi } from '../../api/departments';
import { DepartmentResponse } from '../../types/department';
import { UserResponse } from '../../types/user';
import { UserRole } from '../../types/auth';
import { useToast } from '../../hooks/useToast';
import { ApiError } from '../../types/api';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (user: UserResponse) => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { success, error: toastError } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('EMPLOYEE');
  const [departmentId, setDepartmentId] = useState<string>('');

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      departmentApi
        .getDepartments()
        .then((data) => setDepartments(data))
        .catch((err) => console.warn('Could not fetch departments for user modal:', err));
    }
  }, [isOpen]);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setRole('EMPLOYEE');
    setDepartmentId('');
    setError(null);
    setValidationErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (!fullName) {
      setError('First and last name are required');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const created = await userApi.createUser({
        name: fullName,
        email: email.trim().toLowerCase(),
        password,
        role,
        departmentId: departmentId ? departmentId : null,
      });

      success(`User ${created.name} (${created.role}) created successfully.`, 'User Created');
      onCreated(created);
      handleClose();
    } catch (err) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Failed to create user.';
      setError(msg);
      if (apiErr.validationErrors) {
        setValidationErrors(apiErr.validationErrors);
      }
      toastError(msg, 'User Creation Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const roleOptions = [
    { value: 'EMPLOYEE', label: 'EMPLOYEE — Standard member' },
    { value: 'MANAGER', label: 'MANAGER — Team & department lead' },
    { value: 'ADMIN', label: 'ADMIN — Full workspace administrator' },
  ];

  const departmentOptions = [
    { value: '', label: 'None (Unassigned)' },
    ...departments.map((d) => ({
      value: d.id,
      label: d.name,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New User"
      description="Add a new member to this tenant. Authorization and department scopes will apply immediately."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isLoading}
          >
            Create User
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="First Name"
            placeholder="John"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Last Name"
            placeholder="Doe"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          placeholder="john.doe@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={validationErrors['email']}
          required
        />

        <Input
          label="Initial Password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText="Must be minimum 8 characters"
          error={validationErrors['password']}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Role (RBAC)"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            options={roleOptions}
            required
          />

          <Select
            label="Department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            options={departmentOptions}
            helperText="Optional organizational scope"
          />
        </div>
      </form>
    </Modal>
  );
};
