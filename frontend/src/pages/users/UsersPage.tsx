import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, Search, RefreshCw, Info, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { CreateUserModal } from './CreateUserModal';
import { formatDate } from '../../utils/formatters';

const SESSION_USERS_STORAGE_KEY = 'eka_session_users_cache';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserResponse[]>(() => {
    const cached = sessionStorage.getItem(SESSION_USERS_STORAGE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // fallback
      }
    }
    // Include current authenticated user initially
    if (currentUser) {
      return [
        {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          departmentId: currentUser.departmentId || null,
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    return [];
  });

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [backendListSupported, setBackendListSupported] = useState<boolean | null>(null);

  // Pagination state (UI ready)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Save session users
  useEffect(() => {
    sessionStorage.setItem(SESSION_USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  // Load departments to map department names
  useEffect(() => {
    departmentApi
      .getDepartments()
      .then((data) => setDepartments(data))
      .catch((err) => console.warn('Could not load departments for user table:', err));
  }, []);

  // Attempt to fetch users from backend if available
  const loadUsersFromBackend = async () => {
    setIsLoading(true);
    try {
      const fetched = await userApi.getUsers();
      setUsers(fetched);
      setBackendListSupported(true);
    } catch {
      // Backend does not support GET /api/v1/users yet in Level 1 baseline
      setBackendListSupported(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsersFromBackend();
  }, []);

  const handleUserCreated = (newUser: UserResponse) => {
    setUsers((prev) => [
      { ...newUser, createdAt: new Date().toISOString() },
      ...prev.filter((u) => u.id !== newUser.id),
    ]);
  };

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return 'Unassigned';
    const dept = departments.find((d) => d.id === deptId);
    return dept ? dept.name : deptId.substring(0, 8) + '...';
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery.trim() ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      const matchesDepartment =
        departmentFilter === 'ALL' ||
        (departmentFilter === 'UNASSIGNED' ? !u.departmentId : u.departmentId === departmentFilter);

      return matchesSearch && matchesRole && matchesDepartment;
    });
  }, [users, searchQuery, roleFilter, departmentFilter]);

  // Paginated subset
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const columns: Column<UserResponse>[] = [
    {
      key: 'name',
      header: 'User',
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={item.name} size="sm" />
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 text-xs truncate">{item.name}</div>
            <div className="text-[11px] text-slate-500 truncate">{item.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (item) => (
        <Badge role={item.role} size="sm">
          {item.role}
        </Badge>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (item) => (
        <span
          className={`text-xs ${
            item.departmentId ? 'text-slate-800 font-medium' : 'text-slate-400 italic'
          }`}
        >
          {getDepartmentName(item.departmentId)}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      render: (item) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
            item.active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {item.active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (item) => (
        <span className="text-xs text-slate-500">
          {item.createdAt ? formatDate(item.createdAt) : 'N/A'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <span className="text-[11px] text-slate-400 font-mono">
          {item.id ? `${item.id.substring(0, 8)}...` : '—'}
        </span>
      ),
    },
  ];

  const roleSelectOptions = [
    { value: 'ALL', label: 'All Roles' },
    { value: 'ADMIN', label: 'ADMIN' },
    { value: 'MANAGER', label: 'MANAGER' },
    { value: 'EMPLOYEE', label: 'EMPLOYEE' },
  ];

  const departmentSelectOptions = [
    { value: 'ALL', label: 'All Departments' },
    { value: 'UNASSIGNED', label: 'Unassigned' },
    ...departments.map((d) => ({
      value: d.id,
      label: d.name,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision and manage tenant users, department assignments, and access privileges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsersFromBackend}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            Create User
          </Button>
        </div>
      </div>

      {/* Backend API State Notice Banner */}
      {backendListSupported === false && (
        <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold">Backend Integration Status:</span> User creation connects directly to <code className="font-mono bg-blue-100/70 px-1 py-0.5 rounded text-[11px]">POST /api/v1/users</code>. Created users and your current administrator profile are displayed below. Bulk server query (<code className="font-mono bg-blue-100/70 px-1 py-0.5 rounded text-[11px]">GET /api/v1/users</code>) will synchronize automatically once enabled on the backend.
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="w-full md:flex-1">
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="w-full md:w-44">
          <Select
            options={roleSelectOptions}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="w-full md:w-52">
          <Select
            options={departmentSelectOptions}
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Users Table */}
      <Table
        columns={columns}
        data={paginatedUsers}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyTitle="No users found"
        emptyDescription={
          searchQuery || roleFilter !== 'ALL' || departmentFilter !== 'ALL'
            ? 'No users match your active filter criteria.'
            : 'Get started by creating your first team member.'
        }
        emptyActionText={!searchQuery && roleFilter === 'ALL' ? 'Create User' : undefined}
        onEmptyAction={
          !searchQuery && roleFilter === 'ALL' ? () => setIsCreateModalOpen(true) : undefined
        }
      />

      {/* Pagination Controls */}
      {filteredUsers.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-500">
          <div>
            Showing <span className="font-medium text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
            <span className="font-medium text-slate-800">
              {Math.min(currentPage * itemsPerPage, filteredUsers.length)}
            </span>{' '}
            of <span className="font-medium text-slate-800">{filteredUsers.length}</span> members
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="px-2 font-medium text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleUserCreated}
      />
    </div>
  );
};
