import React from 'react';
import { Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans transition-colors duration-150">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-lg mb-4 border border-indigo-400/30">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Enterprise Knowledge Assistant
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Private multi-tenant knowledge workspace
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-[#0a0a0a] py-8 px-6 shadow-xl border border-slate-200 dark:border-[#1f1f1f] rounded-2xl sm:px-10">
          <Outlet />
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Protected enterprise workspace · RBAC & tenant-isolated access
        </div>
      </div>
    </div>
  );
};
