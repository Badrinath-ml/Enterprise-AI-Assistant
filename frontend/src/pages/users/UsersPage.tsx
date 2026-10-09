import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  UserX,
  UserCheck,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/users';
import { departmentApi } from '../../api/departments';
import { UserResponse } from '../../types/user';
import { DepartmentResponse } from '../../types/department';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Table, Column } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';
import { Dropdown } from '../../components/common/Dropdown';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { formatDate } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import { dataSync, useDataSync } from '../../utils/dataSync';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const { success, error: toastError } = useToast();
  const isManager = currentUser?.role === 'MANAGER' || location.pathname === '/team';

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('ALL');
  const [dept, setDept] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserResponse | null>(null);
  const [deactivate, setDeactivate] = useState<UserResponse | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 8;

  const load = async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([
        userApi.getUsers(isManager ? currentUser?.departmentId || undefined : undefined),
        departmentApi.getDepartments(),
      ]);
      setUsers(u);
      setDepartments(d);
    } catch (e) {
      toastError(
        (e as { message?: string }).message || 'Failed to load team members.',
        'Could not load members'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isManager, currentUser?.departmentId]);

  useDataSync(['departments'], () => {
    departmentApi.getDepartments().then(setDepartments).catch(() => {});
  });

  const getDeptName = (id: string | null) => {
    if (!id) return 'Unassigned';
    return departments.find((d) => d.id === id)?.name || 'Assigned';
  };

  const visible = useMemo(
    () => users.filter((u) => u.id !== currentUser?.id),
    [users, currentUser?.id]
  );

  const filtered = useMemo(
    () =>
      visible.filter((u) => {
        const s = q.trim().toLowerCase();
        return (
          (!s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)) &&
          (role === 'ALL' || u.role === role) &&
          (dept === 'ALL' || u.departmentId === dept) &&
          (status === 'ALL' || (status === 'ACTIVE' ? u.active : !u.active))
        );
      }),
    [visible, q, role, dept, status]
  );

  useEffect(() => setPage(1), [q, role, dept, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const data = filtered.slice((page - 1) * perPage, page * perPage);

  const doDeactivate = async () => {
    if (!deactivate) return;
    setActionLoading(true);
    try {
      await userApi.deleteUser(deactivate.id);
      success(`${deactivate.name} was deactivated.`, 'Member Deactivated');
      dataSync.notify('users');
      setDeactivate(null);
      await load();
    } catch (e) {
      toastError(
        (e as { message?: string }).message || 'Failed to deactivate member.',
        'Action Failed'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const reactivate = async (u: UserResponse) => {
    setActionLoading(true);
    try {
      await userApi.updateUser(u.id, {
        name: u.name,
        email: u.email,
        departmentId: u.departmentId,
        role: u.role,
        active: true,
      });
      success(`${u.name} was reactivated.`, 'Member Reactivated');
      dataSync.notify('users');
      await load();
    } catch (e) {
      toastError(
        (e as { message?: string }).message || 'Failed to reactivate member.',
        'Action Failed'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<UserResponse>[] = [
    {
      key: 'name',
      header: 'Member',
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
              {u.name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <Badge role={u.role} size="sm">
          {u.role}
        </Badge>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (u) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {getDeptName(u.departmentId)}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      render: (u) => (
        <span
          className={
            u.active
              ? 'inline-flex px-2 py-0.5 rounded-md border text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
              : 'inline-flex px-2 py-0.5 rounded-md border text-[11px] font-medium bg-slate-100 dark:bg-[#182338] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#22314a]'
          }
        >
          {u.active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (u) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {u.createdAt ? formatDate(u.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <Dropdown
          trigger={
            <button
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182338] transition-colors cursor-pointer"
              aria-label={'Actions for ' + u.name}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          }
          items={[
            {
              label: 'Edit',
              icon: <Pencil className="w-4 h-4" />,
              onClick: () => setEditing(u),
            },
            u.active
              ? {
                  label: 'Deactivate',
                  icon: <UserX className="w-4 h-4" />,
                  onClick: () => setDeactivate(u),
                  danger: true,
                }
              : {
                  label: 'Reactivate',
                  icon: <UserCheck className="w-4 h-4" />,
                  onClick: () => reactivate(u),
                },
          ]}
        />
      ),
    },
  ];

  const roles = [
    { value: 'ALL', label: 'All Roles' },
    { value: 'ADMIN', label: 'Admin' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'EMPLOYEE', label: 'Employee' },
  ];

  const depts = [
    { value: 'ALL', label: 'All Departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const statuses = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {isManager ? 'My Team' : 'Users & Access'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isManager
              ? 'Manage employees and department membership.'
              : 'Manage people, roles, and access in your organization.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            leftIcon={<RefreshCw className={loading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            {isManager ? 'Add Employee' : 'Add User'}
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by name or email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full md:w-40">
          <Select options={roles} value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        {!isManager && (
          <div className="w-full md:w-52">
            <Select options={depts} value={dept} onChange={(e) => setDept(e.target.value)} />
          </div>
        )}
        <div className="w-full md:w-40">
          <Select options={statuses} value={status} onChange={(e) => setStatus(e.target.value)} />
        </div>
      </div>

      <Table
        columns={columns}
        data={data}
        keyExtractor={(u) => u.id}
        isLoading={loading}
        emptyTitle={isManager ? 'No employees found' : 'No users found'}
        emptyDescription={
          q || role !== 'ALL' || dept !== 'ALL' || status !== 'ALL'
            ? 'No team members match your filters.'
            : isManager
            ? 'Add an employee to your department to get started.'
            : 'Add your first organization member to get started.'
        }
        emptyActionText={
          !q && role === 'ALL' && dept === 'ALL' && status === 'ALL'
            ? isManager
              ? 'Add Employee'
              : 'Add User'
            : undefined
        }
        onEmptyAction={() => setCreateOpen(true)}
      />

      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing {(page - 1) * perPage + 1}–
            {Math.min(page * perPage, filtered.length)} of {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span>
              {page} / {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <CreateUserModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />
      <EditUserModal
        isOpen={!!editing}
        user={editing}
        onClose={() => setEditing(null)}
        onUpdated={() => {
          setEditing(null);
          load();
        }}
      />
      <ConfirmDialog
        isOpen={!!deactivate}
        title="Deactivate member?"
        message={
          deactivate
            ? `${deactivate.name} will no longer be able to sign in. Their account and organization history will be preserved.`
            : ''
        }
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={doDeactivate}
        onCancel={() => setDeactivate(null)}
      />
    </div>
  );
};