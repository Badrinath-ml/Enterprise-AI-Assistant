import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';
import { Button } from '../../components/common/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center p-6 font-sans">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-5 shadow-xs">
        <FileQuestion className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold mb-3">
        HTTP 404 Not Found
      </div>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Page Not Found</h1>

      <p className="mt-2 text-sm text-slate-500 max-w-md leading-relaxed">
        The requested resource or page does not exist or has been moved.
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
    </div>
  );
};
