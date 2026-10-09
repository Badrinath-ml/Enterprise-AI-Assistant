import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            {label}
            {props.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative rounded-lg">
          <select
            id={selectId}
            ref={ref}
            className={`block w-full appearance-none rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-[#0a0a0a] transition-colors duration-150 py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
              error
                ? 'border-rose-300 dark:border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-300 dark:border-[#222222] focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500/20'
            } disabled:bg-slate-50 dark:disabled:bg-[#050505] disabled:text-slate-500 dark:disabled:text-slate-500 disabled:border-slate-200 dark:disabled:border-[#1f1f1f] ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="bg-white dark:bg-[#0a0a0a] text-slate-500">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-100">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 dark:text-slate-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
