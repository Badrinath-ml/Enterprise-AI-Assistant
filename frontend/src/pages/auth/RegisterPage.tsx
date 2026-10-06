import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Building, User, ArrowRight, Hash } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { slugify } from '../../utils/formatters';
import { ApiError } from '../../types/api';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [organizationName, setOrganizationName] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleOrganizationNameChange = (val: string) => {
    setOrganizationName(val);
    if (!isSlugManuallyEdited) {
      setOrganizationSlug(slugify(val));
    }
  };

  const handleOrganizationSlugChange = (val: string) => {
    setIsSlugManuallyEdited(true);
    setOrganizationSlug(slugify(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setValidationErrors({});

    // Client-side validations
    if (!organizationName.trim()) {
      setFormError('Organization name is required');
      return;
    }
    if (!organizationSlug.trim()) {
      setFormError('Organization slug is required');
      return;
    }
    if (!name.trim()) {
      setFormError('Admin name is required');
      return;
    }
    if (!email.trim()) {
      setFormError('Email address is required');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        organizationName: organizationName.trim(),
        organizationSlug: organizationSlug.trim().toLowerCase(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      success('Organization and administrator account registered!', 'Registration Complete');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Registration failed. The slug or email may already exist.';
      setFormError(msg);
      if (apiErr.validationErrors) {
        setValidationErrors(apiErr.validationErrors);
      }
      toastError(msg, 'Registration Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Create new organization</h3>
        <p className="text-xs text-slate-500 mt-1">
          Create your organization and the first administrator account.
        </p>
      </div>

      {formError && (
        <div className="mb-5 p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Organization Name"
            placeholder="Acme Corp"
            value={organizationName}
            onChange={(e) => handleOrganizationNameChange(e.target.value)}
            leftIcon={<Building className="w-4 h-4" />}
            error={validationErrors['organizationName']}
            required
          />

          <Input
            label="Organization Slug"
            placeholder="acme"
            value={organizationSlug}
            onChange={(e) => handleOrganizationSlugChange(e.target.value)}
            leftIcon={<Hash className="w-4 h-4" />}
            helperText="Used in login identifier"
            error={validationErrors['organizationSlug']}
            required
          />
        </div>

        <Input
          label="Administrator Full Name"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<User className="w-4 h-4" />}
          error={validationErrors['name']}
          required
        />

        <Input
          label="Work Email"
          type="email"
          placeholder="admin@acme.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          error={validationErrors['email']}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          helperText="Minimum 8 characters with numbers and symbols"
          error={validationErrors['password']}
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Create Organization
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500">
          Already have an organization?{' '}
          <Link
            to="/login"
            className="font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
