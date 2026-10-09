import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  FileText,
  Sparkles,
  ArrowRight,
  FileUp,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Users,
  RefreshCw,
  FolderOpen,
  Search,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { departmentApi } from '../../api/departments';
import { documentApi } from '../../api/documents';
import { userApi } from '../../api/users';
import { DepartmentResponse } from '../../types/department';
import { DocumentResponse, DocumentStatsResponse } from '../../types/document';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../utils/formatters';
import { useDataSync } from '../../utils/dataSync';

export const DashboardPage: React.FC = () => {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [recentDocs, setRecentDocs] = useState<DocumentResponse[]>([]);
  const [stats, setStats] = useState<DocumentStatsResponse | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsFailed, setStatsFailed] = useState(false);
  const [docsFailed, setDocsFailed] = useState(false);
  const [departmentsFailed, setDepartmentsFailed] = useState(false);

  // Guard against race conditions and stale async responses
  const requestGenRef = useRef(0);

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isEmployee = user?.role === 'EMPLOYEE';
  const canManageDocs = isAdmin || isManager;

  const loadDashboard = useCallback(async (isManualRefresh = false) => {
    const currentGen = ++requestGenRef.current;
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    setStatsFailed(false);
    setDocsFailed(false);
    setDepartmentsFailed(false);

    try {
      // 1. Fetch departments (available to all roles)
      const deptPromise = departmentApi
        .getDepartments()
        .catch(() => {
          if (currentGen === requestGenRef.current) setDepartmentsFailed(true);
          return [] as DepartmentResponse[];
        });

      // 2. Fetch real document stats
      const statsPromise = documentApi
        .getStats()
        .catch(() => {
          if (currentGen === requestGenRef.current) setStatsFailed(true);
          return null as DocumentStatsResponse | null;
        });

      // 3. Fetch recent documents authorized for current role
      const docsPromise = documentApi
        .getDocuments({ size: 6, page: 0 })
        .catch(() => {
          if (currentGen === requestGenRef.current) setDocsFailed(true);
          return { content: [] as DocumentResponse[] };
        });

      // 4. Fetch team count for Admins/Managers (Employees cannot access /users)
      const usersPromise = canManageDocs
        ? userApi
            .getUsers(isManager ? user?.departmentId || undefined : undefined)
            .then((res) => res.length)
            .catch(() => null)
        : Promise.resolve(null);

      const [deptList, docStats, docPage, memberCount] = await Promise.all([
        deptPromise,
        statsPromise,
        docsPromise,
        usersPromise,
      ]);

      // Only commit if this request is still the newest generation
      if (currentGen === requestGenRef.current) {
        setDepartments(deptList);
        setStats(docStats);
        setRecentDocs(docPage.content);
        setUserCount(memberCount);
      }
    } finally {
      if (currentGen === requestGenRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [isAdmin, isManager, isEmployee, canManageDocs, user?.departmentId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Automatically sync and refresh dashboard whenever documents, departments, or users are mutated
  useDataSync(['documents', 'departments', 'users'], () => {
    loadDashboard(true);
  });

  // Accurately resolve department name using real backend state
  const departmentName = (() => {
    if (isAdmin) return 'Organization-wide';
    if (!user?.departmentId) return 'Unassigned';
    const found = departments.find((d) => d.id === user.departmentId);
    if (!found) {
      return departmentsFailed ? 'Department' : 'Unassigned (No match)';
    }
    return found.name;
  })();

  const roleLabel =
    user?.role === 'ADMIN'
      ? 'Administrator'
      : user?.role === 'MANAGER'
      ? 'Department Manager'
      : 'Team Member';

  const renderIngestionBadge = (doc: DocumentResponse) => {
    switch (doc.ingestionStatus) {
      case 'INDEXED':
        return (
          <Badge variant="blue" className="normal-case">
            Indexed ({doc.indexedChunkCount} chunks)
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge variant="warning" className="normal-case animate-pulse">
            Processing...
          </Badge>
        );
      case 'QUEUED':
        return <Badge variant="default" className="normal-case">Queued</Badge>;
      case 'FAILED':
        return <Badge variant="error" className="normal-case">Failed</Badge>;
      default:
        return <Badge variant="neutral" className="normal-case">Not Indexed</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1f2d44] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Welcome back, {user?.name || 'User'}
            </h1>
            <Badge variant={isAdmin ? 'purple' : isManager ? 'blue' : 'neutral'}>
              {roleLabel}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {tenant?.name || 'Organization'}
            </span>{' '}
            · {departmentName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(true)}
            disabled={loading || isRefreshing}
            leftIcon={
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            }
          >
            Sync Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Sparkles className="w-4 h-4 text-indigo-500" />}
            onClick={() => navigate('/chat')}
          >
            Ask Assistant
          </Button>
          {canManageDocs && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FileUp className="w-4 h-4" />}
              onClick={() => navigate('/documents')}
            >
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Documents */}
        <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {isEmployee ? 'Accessible Documents' : 'Total Documents'}
            </span>
            <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : statsFailed ? (
              <span className="text-sm font-medium text-amber-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Unavailable
              </span>
            ) : (
              stats?.totalDocuments ?? '—'
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {isEmployee
              ? 'Authorized for your role & department'
              : 'Repository records in your organization'}
          </p>
        </div>

        {/* Metric 2: Approved Documents */}
        <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Approved
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : statsFailed ? (
              <span className="text-sm font-medium text-amber-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Unavailable
              </span>
            ) : (
              stats?.approvedDocuments ?? '—'
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Grounded & available to knowledge chat
          </p>
        </div>

        {/* Metric 3: AI Indexed Vectorized */}
        <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              AI Indexed
            </span>
            <Layers className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-sky-600 dark:text-sky-400">
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : statsFailed ? (
              <span className="text-sm font-medium text-amber-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Unavailable
              </span>
            ) : (
              stats?.indexedDocuments ?? '—'
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Chunked and vectorized with embeddings
          </p>
        </div>

        {/* Metric 4: Role-specific Context Metric */}
        <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {isAdmin
                ? 'Departments'
                : isManager
                ? 'Department Members'
                : 'Knowledge Scope'}
            </span>
            {isAdmin ? (
              <Building2 className="w-4 h-4 text-indigo-400" />
            ) : isManager ? (
              <Users className="w-4 h-4 text-indigo-400" />
            ) : (
              <Building2 className="w-4 h-4 text-indigo-400" />
            )}
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : isAdmin ? (
              departmentsFailed ? 'Unavailable' : departments.length
            ) : isManager ? (
              userCount !== null ? userCount : '—'
            ) : (
              departmentName
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {isAdmin
              ? 'Configured organizational departments'
              : isManager
              ? `Employees in ${departmentName}`
              : `Scoped to ${tenant?.name || 'Organization'}`}
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Documents Section (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1f2d44] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Knowledge Documents
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Latest authorized documentation in your workspace
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/documents')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              View all
            </Button>
          </div>

          <div className="p-5 flex-1">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : docsFailed ? (
              <div className="py-10 text-center">
                <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Could not load recent documents
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Unable to connect to document repository. Please check connection.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => loadDashboard(true)}
                >
                  Retry Loading
                </Button>
              </div>
            ) : recentDocs.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-[#1f2d44]">
                {recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => navigate('/documents')}
                    className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/75 dark:hover:bg-[#182338]/60 rounded-xl px-2.5 -mx-2.5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#182338] text-slate-600 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-[#22314a]">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {doc.title}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                          {doc.originalFileName} · {doc.departmentName || 'Org-wide'} · v
                          {doc.version}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {renderIngestionBadge(doc)}
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                        {formatDate(doc.updatedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <FolderOpen className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No documents found
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                  {canManageDocs
                    ? 'Upload standard operating procedures, manuals, or policies to ground your assistant.'
                    : 'Your workspace currently has no documents published for your department.'}
                </p>
                {canManageDocs && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate('/documents')}
                  >
                    Upload first document
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Role-Aware Shortcuts (1 col) */}
        <div className="space-y-6">
          {/* Assistant Launcher Card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Knowledge Assistant
              </h2>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ask questions grounded directly in your organization's approved documentation.
            </p>

            <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-[#0c121e] border border-slate-200 dark:border-[#1f2d44]">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Grounded Hybrid Retrieval
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Dense vector search + BM25 keyword fusion guarantees citation evidence for every answer.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full mt-3.5"
                onClick={() => navigate('/chat')}
                rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
              >
                Open Knowledge Chat
              </Button>
            </div>
          </div>

          {/* Role-Aware Shortcuts Card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#1f2d44] shadow-xs p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isAdmin ? 'Administration' : isManager ? 'Management Shortcuts' : 'Quick Actions'}
            </h2>

            <div className="mt-3 space-y-2">
              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate('/users')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-[#1f2d44] hover:bg-slate-50 dark:hover:bg-[#182338] text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-500" /> Manage Users & Roles
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => navigate('/departments')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-[#1f2d44] hover:bg-slate-50 dark:hover:bg-[#182338] text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-500" /> Manage Departments
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </>
              )}

              {isManager && (
                <button
                  onClick={() => navigate('/team')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-[#1f2d44] hover:bg-slate-50 dark:hover:bg-[#182338] text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors text-left"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" /> My Department Team ({userCount ?? 0})
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}

              <button
                onClick={() => navigate('/documents')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-[#1f2d44] hover:bg-slate-50 dark:hover:bg-[#182338] text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-500" /> Search Documents Library
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Ingestion Alerts */}
            {stats?.failedDocuments ? (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>{stats.failedDocuments}</strong> document(s) encountered indexing errors.
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
