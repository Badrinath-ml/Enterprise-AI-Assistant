import React, { useEffect, useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { departmentApi } from '../../api/departments';
import { DepartmentResponse } from '../../types/department';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Table, Column } from '../../components/common/Table';
import { ErrorState } from '../../components/common/ErrorState';
import { Dropdown } from '../../components/common/Dropdown';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CreateDepartmentModal } from './CreateDepartmentModal';
import { EditDepartmentModal } from './EditDepartmentModal';
import { useToast } from '../../hooks/useToast';
import { dataSync } from '../../utils/dataSync';

export const DepartmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentResponse | null>(null);
  const [deleting, setDeleting] = useState<DepartmentResponse | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await departmentApi.getDepartments();
      setDepartments(data);
    } catch (e) {
      setError((e as { message?: string }).message || 'Failed to load departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? departments.filter((d) => d.name.toLowerCase().includes(s)) : departments;
  }, [departments, q]);

  const remove = async () => {
    if (!deleting) return;
    setActionLoading(true);
    try {
      await departmentApi.deleteDepartment(deleting.id);
      success(`Department "${deleting.name}" was deleted.`, 'Department Deleted');
      dataSync.notify('departments');
      setDeleting(null);
      await load();
    } catch (e) {
      toastError(
        (e as { message?: string }).message || 'Failed to delete department.',
        'Could not delete department'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<DepartmentResponse>[] = [
    {
      key: 'name',
      header: 'Department Name',
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#182338] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#22314a]">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
            {d.name}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
          Active
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) =>
        isAdmin ? (
          <Dropdown
            trigger={
              <button
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182338] transition-colors cursor-pointer"
                aria-label={'Actions for ' + d.name}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            }
            items={[
              {
                label: 'Edit',
                icon: <Pencil className="w-4 h-4" />,
                onClick: () => setEditing(d),
              },
              {
                label: 'Delete',
                icon: <Trash2 className="w-4 h-4" />,
                onClick: () => setDeleting(d),
                danger: true,
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Departments
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Organize team members and isolate authorized knowledge boundaries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            leftIcon={<RefreshCw className={loading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />}
          >
            Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Department
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Count Bar */}
      <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs flex items-center justify-between gap-4">
        <div className="max-w-xs w-full">
          <Input
            placeholder="Search departments..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {filtered.length} {filtered.length === 1 ? 'department' : 'departments'}
        </div>
      </div>

      {error ? (
        <ErrorState title="Unable to load departments" message={error} onRetry={load} />
      ) : (
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(d) => d.id}
          isLoading={loading}
          emptyTitle="No departments found"
          emptyDescription={
            q
              ? `No departments matching "${q}".`
              : 'Create your first department to organize knowledge.'
          }
          emptyActionText={isAdmin && !q ? 'Add Department' : undefined}
          onEmptyAction={isAdmin && !q ? () => setCreateOpen(true) : undefined}
        />
      )}

      {isAdmin && (
        <>
          <CreateDepartmentModal
            isOpen={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={(d) => {
              setDepartments((p) => [...p, d]);
            }}
          />
          <EditDepartmentModal
            isOpen={!!editing}
            department={editing}
            onClose={() => setEditing(null)}
            onUpdated={(d) => {
              setDepartments((p) => p.map((x) => (x.id === d.id ? d : x)));
            }}
          />
          <ConfirmDialog
            isOpen={!!deleting}
            title="Delete department?"
            message={
              deleting
                ? `Delete "${deleting.name}"? Note: Departments with assigned team members cannot be deleted. This action cannot be undone.`
                : ''
            }
            confirmText="Delete Department"
            cancelText="Cancel"
            variant="danger"
            isLoading={actionLoading}
            onConfirm={remove}
            onCancel={() => setDeleting(null)}
          />
        </>
      )}
    </div>
  );
};