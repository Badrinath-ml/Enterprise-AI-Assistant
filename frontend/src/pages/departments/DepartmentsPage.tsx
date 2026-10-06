import React, { useEffect, useState, useMemo } from 'react';
import { Building2, Plus, Search, RefreshCw, Copy, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { departmentApi } from '../../api/departments';
import { DepartmentResponse } from '../../types/department';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Table, Column } from '../../components/common/Table';
import { ErrorState } from '../../components/common/ErrorState';
import { CreateDepartmentModal } from './CreateDepartmentModal';
import { useToast } from '../../hooks/useToast';

export const DepartmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { info } = useToast();
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const loadDepartments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await departmentApi.getDepartments();
      setDepartments(data);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Failed to load departments.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleDepartmentCreated = (newDept: DepartmentResponse) => {
    setDepartments((prev) => [...prev, newDept]);
  };

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    info('Department UUID copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const q = searchQuery.toLowerCase();
    return departments.filter(
      (d) => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)
    );
  }, [departments, searchQuery]);

  const columns: Column<DepartmentResponse>[] = [
    {
      key: 'name',
      header: 'Department Name',
      render: (dept) => (
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-xs">{dept.name}</div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
              <span>{dept.id}</span>
              <button
                onClick={() => copyToClipboard(dept.id)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-0.5"
                title="Copy Department ID"
              >
                {copiedId === dept.id ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Active
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (dept) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => copyToClipboard(dept.id)}
          leftIcon={<Copy className="w-3.5 h-3.5 text-slate-400" />}
        >
          Copy ID
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Departments</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage organizational divisions within your tenant for role and resource scoping.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDepartments}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Department
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="max-w-xs w-full">
          <Input
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="text-xs text-slate-500">
          {filteredDepartments.length} {filteredDepartments.length === 1 ? 'department' : 'departments'}
        </div>
      </div>

      {/* Content Table or Error */}
      {error ? (
        <ErrorState
          title="Unable to load departments"
          message={error}
          onRetry={loadDepartments}
        />
      ) : (
        <Table
          columns={columns}
          data={filteredDepartments}
          keyExtractor={(dept) => dept.id}
          isLoading={isLoading}
          emptyTitle="No departments found"
          emptyDescription={
            searchQuery
              ? `No departments matching "${searchQuery}".`
              : 'Create your first organizational department to get started.'
          }
          emptyActionText={isAdmin && !searchQuery ? 'Add Department' : undefined}
          onEmptyAction={isAdmin && !searchQuery ? () => setIsModalOpen(true) : undefined}
        />
      )}

      {/* Create Department Modal */}
      {isAdmin && (
        <CreateDepartmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreated={handleDepartmentCreated}
        />
      )}
    </div>
  );
};
