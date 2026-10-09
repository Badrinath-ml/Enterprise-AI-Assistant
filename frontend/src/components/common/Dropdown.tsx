import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const position = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = menuRef.current?.getBoundingClientRect().height || items.length * 40 + 8;
    const gap = 8;
    let top = r.bottom + gap;
    if (top + menuHeight > window.innerHeight - 8 && r.top - menuHeight - gap >= 8) {
      top = r.top - menuHeight - gap;
    }
    let left = align === 'right' ? r.right - menuWidth : r.left;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    if (left < 8) left = 8;
    setStyle({ position: 'fixed', top, left, width: menuWidth, zIndex: 1000 });
  };

  useLayoutEffect(() => {
    if (isOpen) position();
  }, [isOpen, items.length, align]);

  useEffect(() => {
    if (!isOpen) return;
    const outside = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const reposition = () => position();
    document.addEventListener('mousedown', outside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen, items.length, align]);

  return (
    <>
      <div ref={triggerRef} className={`relative inline-block text-left ${className}`}>
        <div onClick={() => setIsOpen((v) => !v)} className="cursor-pointer">
          {trigger}
        </div>
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={style}
            className="rounded-xl bg-white dark:bg-[#0a0a0a] shadow-xl border border-slate-200 dark:border-[#1f1f1f] divide-y divide-slate-100 dark:divide-[#1f1f1f] animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
          >
            <div className="py-1">
              {items.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick();
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition-colors cursor-pointer ${
                    item.danger
                      ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#18181b]'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {item.icon && (
                    <span className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0">
                      {item.icon}
                    </span>
                  )}
                  <span className="font-medium truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
