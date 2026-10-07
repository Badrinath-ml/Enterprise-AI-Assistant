import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { departmentApi } from '../../api/departments';
import { documentApi } from '../../api/documents';
import { DepartmentResponse } from '../../types/department';
import { DocumentResponse, DocumentStatsResponse } from '../../types/document';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../utils/formatters';

export const DashboardPage: React.FC = () => {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [recentDocs, setRecentDocs] = useState<DocumentResponse[]>([]);
  const [stats, setStats] = useState<DocumentStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const canManageDocs = isAdmin || isManager;

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [deptList, docPage, docStats] = await Promise.all([
          isAdmin ? departmentApi.getDepartments().catch(() => []) : Promise.resolve([]),
          documentApi.getDocuments({ size: 5, page: 0 }).catch(() => ({ content: [] })),
          documentApi.getStats().catch(() => null),
        ]);

        if (active) {
          setDepartments(deptList);
          setRecentDocs(docPage.content);
          setStats(docStats);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const departmentName = user?.departmentId
    ? departments.find((d) => d.id === user.departmentId)?.name || 'Department'
    : isAdmin
    ? 'Organization-wide'
    : 'No department assigned';

  const roleLabel =
    user?.role === 'ADMIN'
      ? 'Administrator'
      : user?.role === 'MANAGER'
      ? 'Department Manager'
      : 'Employee';

  const renderIngestionBadge = (doc: DocumentResponse) => {
    switch (doc.ingestionStatus) {
      case 'INDEXED':
        return <Badge variant="blue" className="normal-case">Indexed ({doc.indexedChunkCount} chunks)</Badge>;
      case 'PROCESSING':
        return <Badge variant="warning" className="normal-case animate-pulse">Processing</Badge>;
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
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              Welcome back, {user?.name || 'Team Member'}
            </h1>
            <Badge variant={isAdmin ? 'purple' : isManager ? 'blue' : 'neutral'}>
              {roleLabel}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {tenant?.name || 'Organization'} · {departmentName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Sparkles className="w-4 h-4 text-slate-700" />}
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
        {/* Total Documents */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Documents
            </span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {loading ? <Skeleton className="h-8 w-16" /> : stats?.totalDocuments ?? recentDocs.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Authorized knowledge repository
          </p>
        </div>

        {/* Approved & Active */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Approved
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-700">
            {loading ? <Skeleton className="h-8 w-16" /> : stats?.approvedDocuments ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Active documents available for RAG
          </p>
        </div>

        {/* AI Indexed Chunks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              AI Indexed
            </span>
            <Layers className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-sky-700">
            {loading ? <Skeleton className="h-8 w-16" /> : stats?.indexedDocuments ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Vectorized & ready for search
          </p>
        </div>

        {/* Scope / Department */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Department
            </span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 text-base font-bold text-slate-900 truncate" title={departmentName}>
            {departmentName}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isAdmin ? `${departments.length} organization departments` : 'Scoped access area'}
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Documents Table (2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent Documents</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Latest updates in your knowledge workspace
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
            ) : recentDocs.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => navigate('/documents')}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/75 rounded-lg px-2 -mx-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {doc.title}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {doc.originalFileName} · {doc.departmentName || 'Org-wide'} · v{doc.version}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {renderIngestionBadge(doc)}
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        {formatDate(doc.updatedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="mt-2 text-sm font-medium text-slate-700">No documents yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Upload policies, handbooks, or guides to begin building your enterprise assistant.
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

        {/* Quick Actions & Workspace Info (1 column) */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <h2 className="text-sm font-semibold text-slate-900">Knowledge Assistant</h2>
            <p className="text-xs text-slate-500 mt-1">
              Ask questions grounded directly in your organization's approved documentation.
            </p>
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Sparkles className="w-4 h-4 text-slate-700" />
                Zero Hallucinations Guarantee
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                The assistant answers solely using verified knowledge and provides source citations.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full mt-3"
                onClick={() => navigate('/chat')}
              >
                Open Assistant
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <h2 className="text-sm font-semibold text-slate-900">Workspace Summary</h2>
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Organization</span>
                <span className="font-semibold text-slate-800">{tenant?.name || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Your Role</span>
                <span className="font-semibold text-slate-800">{roleLabel}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Department Scope</span>
                <span className="font-semibold text-slate-800">{departmentName}</span>
              </div>
              {stats?.failedDocuments ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] mt-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{stats.failedDocuments} document(s) need re-indexing.</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
