import React, { useEffect, useState } from 'react';
import { Mail, Shield, Building2, CheckCircle2 } from 'lucide-react';
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
    if (!user?.departmentId) return;
    let active = true;
    setIsLoadingDept(true);
    departmentApi.getDepartments()
      .then((data) => { if (active) setDepartments(data); })
      .catch(() => {})
      .finally(() => { if (active) setIsLoadingDept(false); });
    return () => { active = false; };
  }, [user?.departmentId]);

  const department = user?.departmentId ? departments.find((d) => d.id === user.departmentId)?.name || 'Assigned' : 'Not assigned';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>
        <p className="text-xs text-slate-500 mt-1">Your account and organization details.</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={user?.name} size="lg" status="online" />
            <div>
              <div className="flex items-center gap-2"><h2 className="text-lg font-bold text-slate-900">{user?.name || 'User'}</h2><Badge role={user?.role} size="md">{user?.role}</Badge></div>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
        </div>
        <div className="p-6">
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">Account details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200"><div className="flex items-center gap-2 text-slate-500 text-xs mb-1"><Mail className="w-3.5 h-3.5" /><span className="font-semibold">EMAIL</span></div><p className="text-sm text-slate-800 font-medium">{user?.email || '—'}</p></div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200"><div className="flex items-center gap-2 text-slate-500 text-xs mb-1"><Shield className="w-3.5 h-3.5" /><span className="font-semibold">ROLE</span></div><Badge role={user?.role} size="md">{user?.role}</Badge></div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200"><div className="flex items-center gap-2 text-slate-500 text-xs mb-1"><Building2 className="w-3.5 h-3.5" /><span className="font-semibold">DEPARTMENT</span></div><p className="text-sm text-slate-800 font-medium">{isLoadingDept ? 'Loading...' : department}</p></div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200"><div className="flex items-center gap-2 text-slate-500 text-xs mb-1"><Building2 className="w-3.5 h-3.5" /><span className="font-semibold">ORGANIZATION</span></div><p className="text-sm text-slate-800 font-medium">{tenant?.name || '—'}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};
