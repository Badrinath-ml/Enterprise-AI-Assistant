import React from 'react';
import { Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white shadow-md mb-4">
          <Shield className="w-6 h-6 text-brand-300" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Enterprise Knowledge Assistant
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Multi-tenant secure knowledge & identity platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          <Outlet />
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400">
          Protected by tenant-isolated Spring Security & JWT Bearer authentication.
        </div>
      </div>
    </div>
  );
};
