export function getInitials(name?: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

export function getRoleBadgeVariant(role?: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (role?.toUpperCase()) {
    case 'ADMIN':
      return {
        bg: 'bg-purple-50 text-purple-700',
        text: 'text-purple-700',
        border: 'border-purple-200',
      };
    case 'MANAGER':
      return {
        bg: 'bg-blue-50 text-blue-700',
        text: 'text-blue-700',
        border: 'border-blue-200',
      };
    case 'EMPLOYEE':
    default:
      return {
        bg: 'bg-slate-100 text-slate-700',
        text: 'text-slate-700',
        border: 'border-slate-200',
      };
  }
}
