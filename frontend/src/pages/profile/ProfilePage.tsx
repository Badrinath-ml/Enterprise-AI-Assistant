import React, { useEffect, useState } from 'react';
import {
  Mail,
  Shield,
  Building2,
  CheckCircle2,
  Lock,
  KeyRound,
  LogOut,
  Fingerprint,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { departmentApi } from '../../api/departments';
import { userApi } from '../../api/users';
import { DepartmentResponse } from '../../types/department';
import { Badge } from '../../components/common/Badge';
import { Avatar } from '../../components/common/Avatar';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';

export const ProfilePage: React.FC = () => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [isLoadingDept, setIsLoadingDept] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoadingDept(true);
    departmentApi
      .getDepartments()
      .then((data) => {
        if (active) setDepartments(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingDept(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const departmentName = (() => {
    if (user?.role === 'ADMIN') return 'Organization-wide (All Departments)';
    if (!user?.departmentId) return 'No department assigned';
    const match = departments.find((d) => d.id === user.departmentId);
    return match ? match.name : 'Assigned (Resolving...)';
  })();

  const roleDescription = {
    ADMIN: 'Full organization administrator with management privileges over users, departments, and documents.',
    MANAGER: 'Department manager authorized to upload documents, review files, and manage departmental team members.',
    EMPLOYEE: 'Team member authorized to view approved documents and query the knowledge assistant.',
  }[user?.role || 'EMPLOYEE'];

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!currentPassword.trim()) {
      setPasswordError('Current password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await userApi.changePassword(currentPassword, newPassword);
      toast.success('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to update password. Please try again.';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Account Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal credentials, workspace preferences, and security settings.
        </p>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-[#1f2d44] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={user?.name} size="lg" status="online" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {user?.name || 'User'}
                </h2>
                <Badge role={user?.role} size="md">
                  {user?.role}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-xs font-medium self-start sm:self-auto">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active Session
          </span>
        </div>
      </div>

      {/* Section A: Personal Information */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1f2d44] pb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Personal Information
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified identity and role attributes in your organization.
            </p>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Read-only · Governed by tenant RBAC
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c121e] border border-slate-200 dark:border-[#1f2d44]">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
              <Mail className="w-3.5 h-3.5" />
              <span className="font-semibold uppercase tracking-wider">Work Email</span>
            </div>
            <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">
              {user?.email || '—'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c121e] border border-slate-200 dark:border-[#1f2d44]">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
              <Shield className="w-3.5 h-3.5" />
              <span className="font-semibold uppercase tracking-wider">Access Role</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge role={user?.role} size="md">
                {user?.role}
              </Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user?.role === 'ADMIN' ? 'Full Admin' : user?.role === 'MANAGER' ? 'Manager' : 'Employee'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c121e] border border-slate-200 dark:border-[#1f2d44]">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span className="font-semibold uppercase tracking-wider">Department Assignment</span>
            </div>
            <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">
              {isLoadingDept ? 'Loading...' : departmentName}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c121e] border border-slate-200 dark:border-[#1f2d44]">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span className="font-semibold uppercase tracking-wider">Organization</span>
            </div>
            <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">
              {tenant?.name || '—'}{' '}
              <span className="text-xs text-slate-400">({tenant?.slug || 'slug'})</span>
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
          {roleDescription}
        </p>
      </div>



      {/* Section C: Security & Password Change */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1f2d44] pb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Security & Credentials
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Update your account password. Passwords must be at least 8 characters.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-900/60">
            <Lock className="w-3 h-3" /> Self-Service
          </span>
        </div>

        {/* Error Banner */}
        {passwordError && (
          <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{passwordError}</span>
          </div>
        )}

        <div className="space-y-4 max-w-md">
          <Input
            label="Current Password"
            type="password"
            placeholder="Enter your current password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setPasswordError('');
            }}
            disabled={isChangingPassword}
            leftIcon={<KeyRound className="w-4 h-4" />}
          />
          <Input
            label="New Password"
            type="password"
            placeholder="Enter a new password (min 8 characters)"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordError('');
            }}
            disabled={isChangingPassword}
            leftIcon={<Lock className="w-4 h-4" />}
          />
          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordError('');
            }}
            disabled={isChangingPassword}
            leftIcon={<Lock className="w-4 h-4" />}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
            onClick={handleChangePassword}
            leftIcon={
              isChangingPassword ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <KeyRound className="w-3.5 h-3.5" />
              )
            }
          >
            {isChangingPassword ? 'Updating Password...' : 'Update Password'}
          </Button>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
          After changing your password, your current session remains active. Use your new password for future logins.
        </p>
      </div>

      {/* Section D: Session & Organization Details */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs p-6 space-y-4">
        <div className="border-b border-slate-100 dark:border-[#1f2d44] pb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Session & System Diagnostics
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active JWT claims and multi-tenant isolation identifiers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c121e] border border-slate-200 dark:border-[#1f2d44]">
            <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold">
              Authenticated User ID
            </span>
            <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 truncate">
              {user?.id || '—'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c121e] border border-slate-200 dark:border-[#1f2d44]">
            <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold">
              Tenant Isolation ID
            </span>
            <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 truncate">
              {tenant?.id || user?.tenantId || '—'}
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-between items-center">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Fingerprint className="w-4 h-4 text-emerald-500" /> Stateless JWT session
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            leftIcon={<LogOut className="w-3.5 h-3.5 text-rose-500" />}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

