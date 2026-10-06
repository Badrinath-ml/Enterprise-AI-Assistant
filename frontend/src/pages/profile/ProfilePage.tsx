import React, { useEffect, useState } from 'react';
import { Mail, Shield, Building2, Building, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { departmentApi } from '../../api/departments';
import { DepartmentResponse } from '../../types/department';
import { Badge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';

export const ProfilePage: React.FC = () => {
  const { user, tenant } = useAuth();
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [isLoadingDept, setIsLoadingDept] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (user?.departmentId) {
      setIsLoadingDept(true);
      departmentApi
        .getDepartments()
        .then((data) => {
          if (isMounted) setDepartments(data);
        })
        .catch((err) => console.warn('Could not fetch departments for profile:', err))
        .finally(() => {
          if (isMounted) setIsLoadingDept(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [user?.departmentId]);

  const assignedDepartment = user?.departmentId
    ? departments.find((d) => d.id === user.departmentId)?.name || user.departmentId
    : 'Not Assigned';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Account Profile</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your authenticated identity, tenant membership, and role permissions.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={user?.name} size="lg" status="online" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{user?.name || 'User'}</h2>
                <Badge role={user?.role} size="md">
                  {user?.role}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active Member
            </span>
          </div>
        </div>

        {/* Profile Details List */}
        <div className="p-6">
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">
            Identity & Authorization Attributes
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User ID */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <KeyRound className="w-3.5 h-3.5" />
                <span className="font-semibold uppercase tracking-wider">User Principal ID</span>
              </div>
              <p className="text-xs font-mono text-slate-800 break-all select-all">
                {user?.id || '—'}
              </p>
            </div>

            {/* Email */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Mail className="w-3.5 h-3.5" />
                <span className="font-semibold uppercase tracking-wider">Email Address</span>
              </div>
              <p className="text-xs text-slate-800 font-medium">{user?.email || '—'}</p>
            </div>

            {/* Role */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Shield className="w-3.5 h-3.5" />
                <span className="font-semibold uppercase tracking-wider">Assigned Role</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge role={user?.role} size="md">
                  {user?.role}
                </Badge>
                <span className="text-[11px] text-slate-500">
                  {user?.role === 'ADMIN'
                    ? 'Full administrative control over tenant users and departments'
                    : user?.role === 'MANAGER'
                    ? 'Team lead with department read permissions'
                    : 'Standard enterprise access privileges'}
                </span>
              </div>
            </div>

            {/* Department */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Building2 className="w-3.5 h-3.5" />
                <span className="font-semibold uppercase tracking-wider">Department Assignment</span>
              </div>
              <p className="text-xs text-slate-800 font-medium">
                {isLoadingDept ? 'Loading department...' : assignedDepartment}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tenant Scope Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Building className="w-4 h-4 text-slate-600" />
          Tenant Scope Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50">
            <span className="block text-[11px] text-slate-500 uppercase tracking-wider">
              Tenant Name
            </span>
            <span className="text-sm font-semibold text-slate-900 mt-1 block">
              {tenant?.name || 'Tenant'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50">
            <span className="block text-[11px] text-slate-500 uppercase tracking-wider">
              Tenant Slug
            </span>
            <span className="text-sm font-mono font-medium text-slate-800 mt-1 block">
              {tenant?.slug || 'workspace'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50">
            <span className="block text-[11px] text-slate-500 uppercase tracking-wider">
              Tenant UUID
            </span>
            <span className="text-xs font-mono text-slate-700 mt-1 block truncate" title={tenant?.id}>
              {tenant?.id || '—'}
            </span>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
          <span>Tenant boundary enforced at database & JWT principal layer.</span>
          <span className="text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Isolation Verified
          </span>
        </div>
      </div>
    </div>
  );
};
