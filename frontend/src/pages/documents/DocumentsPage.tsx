import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, MoreHorizontal, Pencil, RefreshCw, Search, Trash2, Eye, FileUp, Replace } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { documentApi } from '../../api/documents';
import { departmentApi } from '../../api/departments';
import { DocumentResponse, DocumentStatus } from '../../types/document';
import { DepartmentResponse } from '../../types/department';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Table, Column } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Dropdown } from '../../components/common/Dropdown';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Modal } from '../../components/common/Modal';
import { UploadDocumentModal } from './UploadDocumentModal';
import { EditDocumentModal } from './EditDocumentModal';
import { ReplaceDocumentModal } from './ReplaceDocumentModal';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentResponse | null>(null);
  const [replacing, setReplacing] = useState<DocumentResponse | null>(null);
  const [deleting, setDeleting] = useState<DocumentResponse | null>(null);
  const [preview, setPreview] = useState<{ doc: DocumentResponse; url: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const canManage = isAdmin || user?.role === 'MANAGER';

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const result = await documentApi.getDocuments({
        q: q.trim() || undefined,
        status: (status || undefined) as DocumentStatus | undefined,
        departmentId: isAdmin && departmentId ? departmentId : undefined,
        page: targetPage,
        size: 10,
      });
      setDocuments(result.content);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotal(result.totalElements);
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to load documents.', 'Could not load documents');
    } finally { setLoading(false); }
  };

  const loadDepartments = async () => {
    if (!isAdmin) {
      setDepartments([]);
      return;
    }
    try {
      setDepartments(await departmentApi.getDepartments());
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to load departments.', 'Could not load departments');
    }
  };

  useEffect(() => { load(0); }, [q, status, departmentId, isAdmin, user?.departmentId]);
  useEffect(() => { loadDepartments(); }, [isAdmin]);

  const openPreview = async (doc: DocumentResponse) => {
    try {
      const blob = await documentApi.fetchContent(doc.id);
      const url = URL.createObjectURL(blob);
      setPreview({ doc, url });
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to preview document.', 'Preview Failed');
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const download = async (doc: DocumentResponse) => {
    try {
      const blob = await documentApi.fetchContent(doc.id, true);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = doc.originalFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to download document.', 'Download Failed');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setActionLoading(true);
    try {
      await documentApi.deleteDocument(deleting.id);
      success(`"${deleting.title}" was deleted.`, 'Document Deleted');
      setDeleting(null);
      await load(page);
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to delete document.', 'Delete Failed');
    } finally { setActionLoading(false); }
  };

  const filteredCountLabel = useMemo(() => total === 1 ? '1 document' : `${total} documents`, [total]);

  const statusBadge = (s: DocumentStatus) => {
    switch (s) {
      case 'APPROVED': return <Badge variant="success">Approved</Badge>;
      case 'PENDING_REVIEW': return <Badge variant="warning">Pending</Badge>;
      case 'REJECTED': return <Badge variant="error">Rejected</Badge>;
      case 'ARCHIVED': return <Badge variant="neutral">Archived</Badge>;
      case 'DRAFT':
      default: return <Badge variant="default">Draft</Badge>;
    }
  };

  const ingestionBadge = (doc: DocumentResponse) => {
    switch (doc.ingestionStatus) {
      case 'INDEXED':
        return <Badge variant="blue" className="normal-case">Indexed ({doc.indexedChunkCount} chunks)</Badge>;
      case 'PROCESSING':
        return <Badge variant="warning" className="normal-case animate-pulse">Processing...</Badge>;
      case 'QUEUED':
        return <Badge variant="default" className="normal-case">Queued</Badge>;
      case 'FAILED':
        return (
          <span title={doc.ingestionError || 'Ingestion failed'}>
            <Badge variant="error" className="normal-case cursor-help">Failed</Badge>
          </span>
        );
      case 'NOT_INDEXED':
      default:
        return <Badge variant="neutral" className="normal-case">Not Indexed</Badge>;
    }
  };

  const retryIngestion = async (doc: DocumentResponse) => {
    try {
      await documentApi.retryIngestion(doc.id);
      success(`Ingestion queued for "${doc.title}".`, 'Ingestion Queued');
      await load(page);
    } catch (e) {
      error((e as { message?: string }).message || 'Unable to retry ingestion.', 'Retry Failed');
    }
  };

  const columns: Column<DocumentResponse>[] = [
    { key: 'title', header: 'Document', render: d => <div className="flex items-center gap-2.5"><div className="p-1.5 rounded-md bg-slate-100 text-slate-600"><FileText className="w-4 h-4"/></div><div className="min-w-0"><div className="font-semibold text-slate-900 text-xs truncate max-w-[260px]">{d.title}</div><div className="text-[11px] text-slate-500 truncate max-w-[260px]">{d.originalFileName} · v{d.version}</div></div></div> },
    { key: 'department', header: 'Department', render: d => <span className="text-xs text-slate-700">{d.departmentName || 'Organization-wide'}</span> },
    { key: 'status', header: 'Status', render: d => statusBadge(d.status) },
    { key: 'ingestion', header: 'AI Indexing', render: d => ingestionBadge(d) },
    { key: 'size', header: 'Size', render: d => <span className="text-xs text-slate-500">{formatSize(d.fileSize)}</span> },
    { key: 'updatedAt', header: 'Updated', render: d => <span className="text-xs text-slate-500">{formatDate(d.updatedAt)}</span> },
    { key: 'actions', header: '', align: 'right', render: d => <Dropdown trigger={<button className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label={`Actions for ${d.title}`}><MoreHorizontal className="w-4 h-4"/></button>} items={[
      { label: 'Preview', icon: <Eye className="w-4 h-4"/>, onClick: () => openPreview(d) },
      { label: 'Download', icon: <Download className="w-4 h-4"/>, onClick: () => download(d) },
      ...(canManage ? [
        ...((d.status === 'DRAFT' || d.status === 'PENDING_REVIEW') ? [
          { label: 'Approve', icon: <RefreshCw className="w-4 h-4"/>, onClick: async () => {
            try {
              await documentApi.approve(d.id);
              success(`"${d.title}" is now approved and available to RAG.`, 'Document Approved');
              await load(page);
            } catch (e) {
              error((e as { message?: string }).message || 'Unable to approve document.', 'Approval Failed');
            }
          } }
        ] : []),
        ...(d.ingestionStatus === 'FAILED' ? [
          { label: 'Retry Indexing', icon: <RefreshCw className="w-4 h-4"/>, onClick: () => retryIngestion(d) }
        ] : []),
        { label: 'Edit details', icon: <Pencil className="w-4 h-4"/>, onClick: () => setEditing(d) },
        { label: 'Replace file', icon: <Replace className="w-4 h-4"/>, onClick: () => setReplacing(d) },
        { label: 'Delete', icon: <Trash2 className="w-4 h-4"/>, onClick: () => setDeleting(d), danger: true },
      ] : []),
    ]}/> },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div><h1 className="text-xl font-bold text-slate-900">Documents</h1><p className="text-xs text-slate-500 mt-1">Browse and manage authorized documents.</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => load(page)} disabled={loading} leftIcon={<RefreshCw className={loading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'}/>}>Refresh</Button>{canManage && <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)} leftIcon={<FileUp className="w-4 h-4"/>}>Upload</Button>}</div>
    </div>
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
      <div className="flex-1"><Input placeholder="Search title, description, or filename..." value={q} onChange={e => setQ(e.target.value)} leftIcon={<Search className="w-4 h-4"/>}/></div>
      <div className="w-full md:w-44"><Select options={statusOptions} value={status} onChange={e => setStatus(e.target.value)}/></div>
      {isAdmin && <div className="w-full md:w-52"><Select options={[{ value: '', label: 'All Departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))]} value={departmentId} onChange={e => setDepartmentId(e.target.value)}/></div>}
    </div>
    <div className="text-xs text-slate-500 px-1">{filteredCountLabel}</div>
    <Table columns={columns} data={documents} keyExtractor={d => d.id} isLoading={loading} emptyTitle="No documents found" emptyDescription={q || status || departmentId ? 'No documents match your filters.' : 'Upload a document to start building your workspace.'} emptyActionText={!q && !status && !departmentId && canManage ? 'Upload Document' : undefined} onEmptyAction={() => setUploadOpen(true)}/>
    {totalPages > 1 && <div className="flex items-center justify-between px-2 text-xs text-slate-500"><span>Page {page + 1} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => load(page - 1)} disabled={page <= 0}>Previous</Button><Button variant="outline" size="sm" onClick={() => load(page + 1)} disabled={page >= totalPages - 1}>Next</Button></div></div>}
    <UploadDocumentModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} departments={departments} onUploaded={() => load(0)}/>
    <EditDocumentModal isOpen={!!editing} document={editing} departments={departments} onClose={() => setEditing(null)} onUpdated={() => { setEditing(null); load(page); }}/>
    <ReplaceDocumentModal isOpen={!!replacing} document={replacing} onClose={() => setReplacing(null)} onUpdated={() => { setReplacing(null); load(page); }}/>
    <ConfirmDialog isOpen={!!deleting} title="Delete document?" message={deleting ? `Delete "${deleting.title}"? This removes the stored file and cannot be undone.` : ''} confirmText="Delete Document" cancelText="Cancel" variant="danger" isLoading={actionLoading} onConfirm={remove} onCancel={() => setDeleting(null)}/>
    <Modal isOpen={!!preview} onClose={closePreview} title={preview?.doc.title || 'Preview'} description={preview ? `${preview.doc.originalFileName} · v${preview.doc.version}` : ''} size="xl">
      {preview && (preview.doc.mimeType === 'application/pdf' ? <iframe src={preview.url} title={preview.doc.title} className="w-full h-[65vh] rounded border border-slate-200"/> : preview.doc.mimeType.startsWith('text/') ? <iframe src={preview.url} title={preview.doc.title} className="w-full h-[65vh] rounded border border-slate-200 bg-white"/> : <div className="py-12 text-center"><FileText className="w-10 h-10 mx-auto text-slate-400"/><p className="mt-3 text-sm font-medium text-slate-700">Preview is not available for DOCX in the browser.</p><p className="text-xs text-slate-500 mt-1">Download the file to open it in Microsoft Word or another compatible editor.</p><Button className="mt-4" variant="primary" onClick={() => download(preview.doc)}>Download file</Button></div>)}
    </Modal>
  </div>;
};
