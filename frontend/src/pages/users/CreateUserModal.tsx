import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { userApi } from '../../api/users';
import { departmentApi } from '../../api/departments';
import { DepartmentResponse } from '../../types/department';
import { UserResponse } from '../../types/user';
import { UserRole } from '../../types/auth';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ApiError } from '../../types/api';

interface CreateUserModalProps { isOpen: boolean; onClose: () => void; onCreated: (user: UserResponse) => void; }

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { user: currentUser } = useAuth();
  const { success, error: toastError } = useToast();
  const isManager = currentUser?.role === 'MANAGER';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('EMPLOYEE');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    departmentApi.getDepartments().then(setDepartments).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (isManager && currentUser?.departmentId) setDepartmentId(currentUser.departmentId);
  }, [isManager, currentUser?.departmentId]);

  const resetForm = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPassword('');
    setRole('EMPLOYEE'); setDepartmentId(isManager && currentUser?.departmentId ? currentUser.departmentId : '');
    setError(null); setValidationErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setValidationErrors({});
    const fullName = (firstName.trim() + ' ' + lastName.trim()).trim();
    if (!fullName) return setError('First and last name are required');
    if (!email.trim()) return setError('Email address is required');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    setIsLoading(true);
    try {
      const created = await userApi.createUser({ name: fullName, email: email.trim().toLowerCase(), password, role: isManager ? 'EMPLOYEE' : role, departmentId: departmentId || null });
      success(created.name + ' was added successfully.', 'Member Added');
      onCreated(created);
      onClose();
      resetForm();
    } catch (err) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Failed to add member.';
      setError(msg);
      if (apiErr.validationErrors) setValidationErrors(apiErr.validationErrors);
      toastError(msg, 'Could not add member');
    } finally { setIsLoading(false); }
  };

  const roleOptions = isManager
    ? [{ value: 'EMPLOYEE', label: 'Employee' }]
    : [{ value: 'EMPLOYEE', label: 'Employee' }, { value: 'MANAGER', label: 'Manager' }, { value: 'ADMIN', label: 'Admin' }];

  const departmentOptions = isManager
    ? departments.filter((d) => d.id === currentUser?.departmentId).map((d) => ({ value: d.id, label: d.name }))
    : [{ value: '', label: 'No department' }, ...departments.map((d) => ({ value: d.id, label: d.name }))];

  return <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title={isManager ? 'Add Employee' : 'Add User'} description={isManager ? 'Add an employee to your department.' : 'Add a member to your organization.'} footer={<><Button variant="ghost" size="sm" onClick={() => { resetForm(); onClose(); }} disabled={isLoading}>Cancel</Button><Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>{isManager ? 'Add Employee' : 'Add User'}</Button></>}>
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="First Name" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
        <Input label="Last Name" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </div>
      <Input label="Email Address" type="email" placeholder="john.doe@company.com" value={email} onChange={(e) => setEmail(e.target.value)} error={validationErrors['email']} required />
      <Input label="Initial Password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} helperText="Must be at least 8 characters" error={validationErrors['password']} required />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Role" value={isManager ? 'EMPLOYEE' : role} onChange={(e) => setRole(e.target.value as UserRole)} options={roleOptions} disabled={isManager} required />
        <Select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} options={departmentOptions} disabled={isManager} />
      </div>
    </form>
  </Modal>;
};
