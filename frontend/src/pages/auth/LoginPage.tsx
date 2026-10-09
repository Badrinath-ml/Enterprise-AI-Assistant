import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, Building, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ApiError } from '../../types/api';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenantSlug.trim()) {
      setFormError('Organization slug is required');
      return;
    }
    if (!email.trim()) {
      setFormError('Email address is required');
      return;
    }
    if (!password) {
      setFormError('Password is required');
      return;
    }

    setIsLoading(true);
    try {
      await login(
        {
          tenantSlug: tenantSlug.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          password,
        },
        rememberMe
      );
      success('Logged in successfully', 'Welcome back');
      navigate(from, { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Invalid credentials or organization not found';
      setFormError(msg);
      toastError(msg, 'Authentication Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Sign in to your account
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Enter your organization details and credentials to continue.
        </p>
      </div>

      {formError && (
        <div className="mb-5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Organization Slug"
          placeholder="e.g. acme"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          leftIcon={<Building className="w-4 h-4" />}
          helperText="Your organization's unique workspace slug"
          required
          autoComplete="organization"
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          required
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">Remember this session</span>
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Sign In
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#1f2d44] text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Need to create a new organization?{' '}
          <Link
            to="/register"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
          >
            Create organization
          </Link>
        </p>
      </div>
    </div>
  );
};
