import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';

export const AccessDeniedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-5 shadow-xs">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold mb-3">
        HTTP 403 Forbidden
      </div>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access Denied</h1>

      <p className="mt-2 text-sm text-slate-500 max-w-md leading-relaxed">
        Your current role (<span className="font-semibold text-slate-800">{user?.role || 'Guest'}</span>) does not have sufficient administrative privileges to access this area.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="md"
          onClick={() => navigate(-1)}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Go Back
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/dashboard')}
          leftIcon={<Home className="w-4 h-4" />}
        >
          Dashboard
        </Button>
      </div>

      <p className="mt-8 text-[11px] text-slate-400">
        If you need access to this area, contact your organization administrator.
      </p>
    </div>
  );
};
