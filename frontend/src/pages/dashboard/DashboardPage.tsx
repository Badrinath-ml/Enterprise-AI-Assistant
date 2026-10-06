import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  Server,
  Shield,
  PlusCircle,
  UserPlus,
  ArrowRight,
  Activity,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { departmentApi } from '../../api/departments';
import { systemApi } from '../../api/system';
import { DepartmentResponse } from '../../types/department';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';

export const DashboardPage: React.FC = () => {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [systemStatus, setSystemStatus] = useState<string>('CHECKING');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fetch departments and system health in parallel
        const [deptData, healthData] = await Promise.allSettled([
          departmentApi.getDepartments(),
          systemApi.getHealth(),
        ]);

        if (isMounted) {
          if (deptData.status === 'fulfilled') {
            setDepartments(deptData.value);
          }
          if (healthData.status === 'fulfilled') {
            setSystemStatus(healthData.value.status);
          } else {
            setSystemStatus('DOWN');
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Welcome back, {user?.name || 'Team Member'}
            </h1>
            <Badge role={user?.role} size="md">
              {user?.role}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Signed in to <span className="font-semibold text-slate-700">{tenant?.name || 'Workspace'}</span> ({tenant?.slug || 'tenant'}). All data is tenant-isolated.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<PlusCircle className="w-4 h-4 text-slate-600" />}
                onClick={() => navigate('/departments')}
              >
                Add Department
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<UserPlus className="w-4 h-4" />}
                onClick={() => navigate('/users')}
              >
                Create User
              </Button>
            </>
          )}
          {isManager && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Building2 className="w-4 h-4 text-slate-600" />}
              onClick={() => navigate('/departments')}
            >
              View Departments
            </Button>
          )}
          {!isAdmin && !isManager && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowRight className="w-4 h-4 text-slate-600" />}
              onClick={() => navigate('/profile')}
            >
              View Profile
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Departments */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Departments</span>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <Building2 className="w-4 h-4 text-slate-700" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">{departments.length}</div>
            )}
            <p className="text-[11px] text-slate-500 mt-1">Configured in organization</p>
          </div>
        </div>

        {/* Card 2: User Scope */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isAdmin ? 'User Management' : 'Access Scope'}
            </span>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <Users className="w-4 h-4 text-slate-700" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {isAdmin ? 'Active' : user?.role || 'Standard'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {isAdmin
                ? 'Role-based administration enabled'
                : 'Role permissions applied'}
            </p>
          </div>
        </div>

        {/* Card 3: Backend Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Backend Service</span>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <Server className="w-4 h-4 text-slate-700" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    systemStatus === 'UP' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <span className="text-lg font-bold text-slate-900">
                  {systemStatus === 'UP' ? 'Operational' : 'Unreachable'}
                </span>
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-1">Spring Boot Health Actuator</p>
          </div>
        </div>

        {/* Card 4: Tenant Boundary */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Tenant Isolation</span>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <Shield className="w-4 h-4 text-slate-700" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-slate-900 truncate">
              {tenant?.slug || 'Isolated'}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> Encforced via JWT principal
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Departments Overview & System Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Departments List preview (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              <h2 className="text-sm font-semibold text-slate-900">Departments Overview</h2>
            </div>
            {(isAdmin || isManager) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/departments')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                View all
              </Button>
            )}
          </div>

          <div className="p-5">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : departments.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No departments created yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Departments organize your users and teams.
                </p>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate('/departments')}
                  >
                    Create first department
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {departments.slice(0, 5).map((dept) => (
                  <div key={dept.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-medium text-slate-900">{dept.name}</h3>
                      <p className="text-[10px] text-slate-400 font-mono">ID: {dept.id}</p>
                    </div>
                    <span className="text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Platform Information & Activity placeholder */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-900">Platform Scope</h2>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Shield className="w-3.5 h-3.5 text-slate-600" />
                  Phase 1 Scope Active
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Authentication, Tenant Isolation, RBAC visibility, and Department management are online.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50/60 border border-slate-100 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Audit & Activity Log
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Server-side activity audit trail scheduled for Level 1 next stage backend release.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Security Level: Level 1 CRUD</span>
              <span className="font-mono text-[10px]">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
