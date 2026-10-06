import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { CreateUserModal } from './CreateUserModal';
import { formatDate } from '../../utils/formatters';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const isManager = currentUser?.role === 'MANAGER' || location.pathname === '/team';
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const load = async () => {
    setIsLoading(true);
    try {
      const [userData, deptData] = await Promise.all([
        userApi.getUsers(isManager ? currentUser?.departmentId || undefined : undefined),
        departmentApi.getDepartments(),
      ]);
      setUsers(userData);
      setDepartments(deptData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [isManager, currentUser?.departmentId]);

  const getDepartmentName = (id: string | null) => {
    if (!id) return 'Unassigned';
    return departments.find((d) => d.id === id)?.name || 'Assigned';
  };

  const filteredUsers = useMemo(() => users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const searchMatch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const roleMatch = roleFilter === 'ALL' || u.role === roleFilter;
    const deptMatch = departmentFilter === 'ALL' || u.departmentId === departmentFilter;
    return searchMatch && roleMatch && deptMatch;
  }), [users, searchQuery, roleFilter, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const columns: Column<UserResponse>[] = [
    { key: 'name', header: 'Member', render: (item) => <div className="flex items-center gap-2.5"><Avatar name={item.name} size="sm" /><div><div className="font-semibold text-slate-900 text-xs">{item.name}</div><div className="text-[11px] text-slate-500">{item.email}</div></div></div> },
    { key: 'role', header: 'Role', render: (item) => <Badge role={item.role} size="sm">{item.role}</Badge> },
    { key: 'department', header: 'Department', render: (item) => <span className="text-xs text-slate-700">{getDepartmentName(item.departmentId)}</span> },
    { key: 'active', header: 'Status', render: (item) => <span className={item.active ? 'inline-flex px-2 py-0.5 rounded border text-[11px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200' : 'inline-flex px-2 py-0.5 rounded border text-[11px] font-medium bg-slate-100 text-slate-600 border-slate-200'}>{item.active ? 'Active' : 'Inactive'}</span> },
    { key: 'createdAt', header: 'Joined', render: (item) => <span className="text-xs text-slate-500">{item.createdAt ? formatDate(item.createdAt) : '—'}</span> },
  ];

  const roleOptions = [
    { value: 'ALL', label: 'All Roles' },
    { value: 'ADMIN', label: 'Admin' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'EMPLOYEE', label: 'Employee' },
  ];
  const departmentOptions = [
    { value: 'ALL', label: 'All Departments' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-xl font-bold text-slate-900">{isManager ? 'My Team' : 'Users'}</h1><p className="text-xs text-slate-500 mt-1">{isManager ? 'Manage employees in your department.' : 'Manage people in your organization.'}</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading} leftIcon={<RefreshCw className={isLoading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />}>Refresh</Button>
          <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)} leftIcon={<UserPlus className="w-4 h-4" />}>{isManager ? 'Add Employee' : 'Add User'}</Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1"><Input placeholder="Search by name or email..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} leftIcon={<Search className="w-4 h-4" />} /></div>
        <div className="w-full md:w-40"><Select options={roleOptions} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }} /></div>
        {!isManager && <div className="w-full md:w-52"><Select options={departmentOptions} value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }} /></div>}
      </div>

      <Table columns={columns} data={paginatedUsers} keyExtractor={(item) => item.id} isLoading={isLoading} emptyTitle={isManager ? 'No employees yet' : 'No users found'} emptyDescription={searchQuery || roleFilter !== 'ALL' || departmentFilter !== 'ALL' ? 'No members match your filters.' : isManager ? 'Add an employee to your department to get started.' : 'Add your first organization member to get started.'} emptyActionText={!searchQuery && roleFilter === 'ALL' && departmentFilter === 'ALL' ? (isManager ? 'Add Employee' : 'Add User') : undefined} onEmptyAction={() => setIsCreateModalOpen(true)} />

      {filteredUsers.length > 0 && <div className="flex items-center justify-between px-2 text-xs text-slate-500"><div>Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length}</div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}>Previous</Button><span>{currentPage} / {totalPages}</span><Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>Next</Button></div></div>}

      <CreateUserModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreated={() => load()} />
    </div>
  );
};
