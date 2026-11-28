'use client'
import { useState, useEffect, useRef, useCallback, useMemo, type ComponentProps } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import InlineConfirm from '@/components/InlineConfirm'
import DocumentModal from '@/components/DocumentModal'
import DocumentAccessRequests from '@/components/documents/DocumentAccessRequests'
import {
  AlertCircle,
  Award,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesColumn,
  ContactRound,
  Download,
  FileStack,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutTemplate,
  Mail,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { logActivity } from '@/lib/activity'
import { archiveAndDeleteContent } from '@/lib/content-deletion'
import CreatorTag from '@/components/CreatorTag'
import { EmptyLedger } from '@/components/BrandIllustrations'
import { volunteerContributor } from '@/lib/creator'
import { getDocumentAccess } from '@/lib/document-access'
import { loadStaffDirectory, staffProfile } from '@/lib/staff-directory'
import type { StaffDirectoryEntry } from '@/lib/staff-directory'
import DocumentAssigneePicker from '@/components/DocumentAssigneePicker'

type Document = NonNullable<ComponentProps<typeof DocumentModal>['doc']>

const DOCUMENT_CATEGORIES = [
  { id: 'policy', label: 'Policies', icon: ShieldCheck },
  { id: 'report', label: 'Reports', icon: ChartNoAxesColumn },
  { id: 'template', label: 'Templates', icon: LayoutTemplate },
  { id: 'meeting', label: 'Meetings', icon: CalendarDays },
]

const GENERAL_DOCUMENT_CATEGORIES = [
  { id: 'cv-resume', label: 'CVs & Resumes', icon: UserRound, pattern: /\b(cv|curriculum\s+vitae|resumes?)\b/ },
  { id: 'portfolio', label: 'Portfolios', icon: BriefcaseBusiness, pattern: /\bportfolios?\b/ },
  { id: 'certificate', label: 'Certificates', icon: Award, pattern: /\b(certificates?|qualifications?|awards?)\b/ },
  { id: 'academic-record', label: 'Academic Records', icon: GraduationCap, pattern: /\b(transcripts?|academic|degrees?|diplomas?)\b/ },
  { id: 'identity-document', label: 'Identity Documents', icon: ContactRound, pattern: /\b(identification|identity|passport|national id|nin|driving licence|driver'?s licence)\b/ },
  { id: 'letter', label: 'Letters', icon: Mail, pattern: /\b(cover letters?|reference letters?|recommendation letters?)\b/ },
  { id: 'other-general', label: 'Other Documents', icon: FolderOpen, pattern: null },
]

function getDocumentCategory(doc: Document) {
  const storedCategory = doc.category.trim().toLowerCase()

  if (storedCategory === 'general') {
    const searchableText = `${doc.name} ${doc.description || ''}`
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
    return GENERAL_DOCUMENT_CATEGORIES.find(category => category.pattern?.test(searchableText))
      ?? GENERAL_DOCUMENT_CATEGORIES[GENERAL_DOCUMENT_CATEGORIES.length - 1]
  }

  return DOCUMENT_CATEGORIES.find(category => category.id === storedCategory) ?? {
    id: `category:${storedCategory}`,
    label: storedCategory.replace(/[-_]/g, ' ').replace(/\b\w/g, character => character.toUpperCase()),
    icon: FileText,
  }
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('general')
  const [activeCategory, setActiveCategory] = useState('all')
  // Inline confirm: stores id of doc pending deletion
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [createdByMe, setCreatedByMe] = useState(false)
  const [currentRole, setCurrentRole] = useState('')
  const [assignees, setAssignees] = useState<StaffDirectoryEntry[]>([])
  const [assigneesLoaded, setAssigneesLoaded] = useState(false)
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])
  const [documentsLoaded, setDocumentsLoaded] = useState(false)
  const [chatRequest, setChatRequest] = useState<{ documentId: string; status: string; error: string }>({ documentId: '', status: '', error: '' })
  const [chatRequestReason, setChatRequestReason] = useState('')
  const [requestingChatAccess, setRequestingChatAccess] = useState(false)
  const chatRequestStatusFetchedFor = useRef<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedChatDocumentId = searchParams.get('document')
  const linkedChatDocument = requestedChatDocumentId
    ? docs.find(doc => doc.id === requestedChatDocumentId) || null
    : null
  const chatRequestStatus = chatRequest.documentId === requestedChatDocumentId ? chatRequest.status : ''
  const chatRequestError = chatRequest.documentId === requestedChatDocumentId ? chatRequest.error : ''

  const fetchDocs = useCallback(async () => {
    try {
      const [{ data, error: err }, { data: authData }] = await Promise.all([supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false }), supabase.auth.getUser()])

      if (err) {
        console.error('Error fetching documents:', err)
        setError('Unable to load documents and individual access options. Please refresh and try again.')
        setDocumentsLoaded(true)
        return []
      }
      const staff = await loadStaffDirectory(supabase)
      setAssignees(staff)
      setAssigneesLoaded(true)
      const loadedDocs = (data || []).map(doc => ({ ...doc, profiles: staffProfile(staff, doc.uploaded_by) })) as Document[]
      setDocs(loadedDocs)
      setCurrentUserId(authData.user?.id || '')
      const { data: ownProfile } = authData.user
        ? await supabase.from('profiles').select('role').eq('id', authData.user.id).single()
        : { data: null }
      setCurrentRole(ownProfile?.role || '')
      setDocumentsLoaded(true)
      return loadedDocs
    } catch (e) {
      console.error('Fetch error:', e)
      setError('Unable to load individuals for document access. Please refresh and try again.')
      setDocumentsLoaded(true)
      return []
    }
  }, [supabase])

  useEffect(() => {
    // Initial hydration deliberately updates local state after the first query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocs()

    const channel = supabase
      .channel('documents-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, fetchDocs)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchDocs, supabase])

  const refreshChatRequestStatus = useCallback(async (documentId: string) => {
    if (!currentUserId) return
    const { data, error: requestError } = await supabase
      .from('document_access_requests')
      .select('status')
      .eq('document_id', documentId)
      .eq('requester_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (requestError) {
      console.error('Document access request status could not be loaded:', requestError)
      setChatRequest({ documentId, status: '', error: 'The request status could not be checked. Refresh and try again.' })
      return
    }

    setChatRequest({ documentId, status: data?.status || '', error: '' })
  }, [currentUserId, supabase])

  useEffect(() => {
    if (!requestedChatDocumentId || linkedChatDocument || !documentsLoaded || !currentUserId) return
    if (chatRequestStatusFetchedFor.current === requestedChatDocumentId) return
    chatRequestStatusFetchedFor.current = requestedChatDocumentId
    void refreshChatRequestStatus(requestedChatDocumentId)
  }, [currentUserId, documentsLoaded, linkedChatDocument, refreshChatRequestStatus, requestedChatDocumentId])

  async function requestChatDocumentAccess() {
    if (!requestedChatDocumentId) return
    setRequestingChatAccess(true)
    const { error: requestError } = await supabase.rpc('request_document_access', {
      p_document_id: requestedChatDocumentId,
      p_reason: chatRequestReason.trim() || null,
    })
    if (requestError) {
      console.error('Document access request failed:', requestError)
      setChatRequest({ documentId: requestedChatDocumentId, status: '', error: requestError.message || 'The access request could not be submitted.' })
      setRequestingChatAccess(false)
      return
    }

    setChatRequest({ documentId: requestedChatDocumentId, status: 'pending', error: '' })
    setRequestingChatAccess(false)
  }

  async function checkChatDocumentAccess() {
    if (!requestedChatDocumentId) return
    const refreshedDocs = await fetchDocs()
    const accessibleDocument = refreshedDocs.find(doc => doc.id === requestedChatDocumentId)
    if (accessibleDocument) {
      setSelectedDoc(accessibleDocument)
      return
    }
    await refreshChatRequestStatus(requestedChatDocumentId)
  }

  function closeDocumentPreview() {
    setSelectedDoc(null)
    if (!requestedChatDocumentId) return
    const url = new URL(window.location.href)
    url.searchParams.delete('document')
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setSuccess('')
    setUploading(true)

    try {
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        setError('File too large. Maximum 50MB.')
        setUploading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); setUploading(false); return }

      const sanitizedFileName = file.name.replace(/[^a-z0-9.\-_]/gi, '_')
      const filePath = `${currentRole === 'intern' ? `interns/${user.id}` : user.id}/${Date.now()}-${sanitizedFileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) { setError(`Upload failed: ${uploadError.message}`); setUploading(false); return }

      const { error: dbError } = await supabase.from('documents').insert({
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        category: selectedCategory,
        uploaded_by: user.id,
        assigned_to: selectedAssigneeIds,
        ...volunteerContributor(),
      })

      if (dbError) { setError(`Failed to save document: ${dbError.message}`); setUploading(false); return }

      logActivity('document.upload', 'document', undefined, { name: file.name, category: selectedCategory })

      setSuccess(`"${file.name}" uploaded successfully`)
      setSelectedAssigneeIds([])
      e.target.value = ''
    } catch (err) {
      setError(`Unexpected error: ${err}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(doc: Document) {
    try {
      const { signedUrl } = await getDocumentAccess(doc.id)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleDelete(doc: Document) {
    try {
      setError('')
      if (currentRole === 'intern') {
        const { error: deleteError } = await supabase.from('documents').update({ deleted_at: new Date().toISOString(), deleted_by: currentUserId }).eq('id', doc.id)
        if (deleteError) throw deleteError
        setDocs(items => items.filter(item => item.id !== doc.id))
      } else {
        await archiveAndDeleteContent(supabase, 'document', doc.id)
      }

      setSuccess(`"${doc.name}" was removed from the shared hub and retained for administrator review.`)
      setDeletingDocId(null)
    } catch (err) {
      setError(`Delete error: ${err}`)
    }
  }

  async function handleSaveDocument(updates: Partial<Document>) {
    if (!selectedDoc) return

    try {
      setError('')
      if (currentRole === 'intern' && selectedDoc.uploaded_by !== currentUserId) throw new Error('You can only edit your own uploads.')
      const { error: err } = await supabase
        .from('documents')
        .update({
          name: updates.name,
          description: updates.description,
          category: updates.category,
          assigned_to: updates.assigned_to,
        })
        .eq('id', selectedDoc.id)

      if (err) {
        setError(`Failed to update document: ${err.message}`)
        throw err
      }

      setSuccess(`"${updates.name}" updated successfully`)
      
      // Update local docs state
      setDocs(docs.map(d => 
        d.id === selectedDoc.id 
          ? { ...d, ...updates }
          : d
      ))
      
      // Update selected doc
      setSelectedDoc({ ...selectedDoc, ...updates })
    } catch (err) {
      throw err
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  const visibleDocs = createdByMe ? docs.filter(doc => doc.uploaded_by === currentUserId) : docs
  const categoryCounts = new Map<string, number>()
  for (const doc of visibleDocs) {
    const category = getDocumentCategory(doc)
    categoryCounts.set(category.id, (categoryCounts.get(category.id) ?? 0) + 1)
  }
  const extraCategories = [...new Map(visibleDocs
    .map(doc => getDocumentCategory(doc))
    .filter(category => category.id.startsWith('category:'))
    .map(category => [category.id, category])).values()]
    .sort((a, b) => a.label.localeCompare(b.label))
  const categoryTabs = [
    { id: 'all', label: 'All documents', icon: FileStack },
    ...DOCUMENT_CATEGORIES.filter(category => categoryCounts.has(category.id)),
    ...GENERAL_DOCUMENT_CATEGORIES.filter(category => categoryCounts.has(category.id)),
    ...extraCategories,
  ]
  const selectedCategoryId = categoryTabs.some(category => category.id === activeCategory) ? activeCategory : 'all'
  const selectedCategoryTab = categoryTabs.find(category => category.id === selectedCategoryId)
  const filteredDocs = selectedCategoryId === 'all'
    ? visibleDocs
    : visibleDocs.filter(doc => getDocumentCategory(doc).id === selectedCategoryId)

  return (
    <div>
      <PageHeader title="Documents" description="Upload and access shared files" />

      {currentRole === 'admin' && <DocumentAccessRequests />}

      {requestedChatDocumentId && documentsLoaded && currentUserId && !linkedChatDocument && (
        <section aria-labelledby="chat-document-access-title" className="card mb-6 border-accent/30 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck size={21} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 id="chat-document-access-title" className="font-semibold text-text">This chat document is not shared with you yet</h2>
              <p className="mt-1 text-sm text-muted">Request access from an administrator. They will review the request before access is granted.</p>
              {chatRequestStatus === 'pending' && <p role="status" className="mt-3 text-sm font-medium text-accent">Your request is pending administrator review.</p>}
              {chatRequestStatus === 'approved' && <p role="status" className="mt-3 text-sm font-medium text-success">Your request was approved. Check again to open the document.</p>}
              {chatRequestStatus === 'denied' && <p role="status" className="mt-3 text-sm font-medium text-warning">Your previous request was denied. You may submit a new request.</p>}
              {chatRequestError && <p role="alert" className="mt-3 text-sm text-danger">{chatRequestError}</p>}
              {(chatRequestStatus === '' || chatRequestStatus === 'denied') && <label className="mt-3 block max-w-xl text-xs font-medium text-muted">
                Reason (optional)
                <textarea value={chatRequestReason} onChange={event => setChatRequestReason(event.target.value)} maxLength={500} rows={2} placeholder="Tell the administrators why you need this document" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" />
              </label>}
              <div className="mt-4 flex flex-wrap gap-2">
                {(chatRequestStatus === '' || chatRequestStatus === 'denied') && <button type="button" disabled={requestingChatAccess} onClick={() => void requestChatDocumentAccess()} className="btn-primary min-h-10 disabled:opacity-60">
                  {requestingChatAccess ? 'Requesting…' : chatRequestStatus === 'denied' ? 'Request access again' : 'Request access'}
                </button>}
                {(chatRequestStatus === 'pending' || chatRequestStatus === 'approved') && <button type="button" onClick={() => void checkChatDocumentAccess()} className="min-h-10 rounded-lg border border-border px-4 text-sm font-semibold text-text hover:bg-surface-muted">
                  Check access
                </button>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Modal */}
      <DocumentModal
        doc={linkedChatDocument || selectedDoc}
        onClose={closeDocumentPreview}
        onSave={handleSaveDocument}
        assignees={assignees}
      />

      {/* Upload Section */}
      <div className="card mb-6 border-dashed bg-surface p-4 hover:border-accent-hover sm:p-8">
        <div className="flex flex-col items-center justify-center">
          <div className="mb-4 p-3 bg-surface-muted rounded-lg">
            <Upload size={24} className="text-pink-text" />
          </div>
          <h2 className="text-lg font-semibold text-text mb-2">Upload Document</h2>
          <p className="text-sm text-muted mb-4">PDF, Word, Excel, Images (max 50MB)</p>

          <div className="flex gap-4 mb-4 w-full max-w-sm">
            <label className="flex-1">
              <span className="text-xs font-medium text-text block mb-2">Category</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="general">General</option>
                <option value="policy">Policy</option>
                <option value="report">Report</option>
                <option value="template">Template</option>
                <option value="meeting">Meeting</option>
              </select>
            </label>
          </div>
          <div className="mb-4 w-full max-w-sm">
            <DocumentAssigneePicker
              assignees={assignees}
              selectedIds={selectedAssigneeIds}
              onChange={setSelectedAssigneeIds}
              disabled={uploading}
            />
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              onChange={handleUpload}
              disabled={uploading || !assigneesLoaded}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
            />
            <div className="btn-primary">
              {uploading ? 'Uploading…' : assigneesLoaded ? 'Choose File' : 'Loading individuals…'}
            </div>
          </label>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-danger/10 border border-danger rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-danger shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-danger">Error</h3>
            <p className="text-sm text-danger mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-success bg-success/10 p-4">
          <p className="text-sm font-medium text-success">{success}</p>
        </div>
      )}

      {/* Documents List */}
      <div>
        <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-text">{filteredDocs.length} {filteredDocs.length === 1 ? 'Document' : 'Documents'}</h2>
            <p className="mt-1 text-sm text-muted">
              Browse your files by category
            </p>
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-muted sm:border-0 sm:p-0">
            <input type="checkbox" checked={createdByMe} onChange={event => setCreatedByMe(event.target.checked)} />
            Created by me
          </label>
        </div>

        <div
          role="tablist"
          aria-label="Document categories"
          className="no-scrollbar mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-surface-muted/60 p-2"
        >
          {categoryTabs.map(category => {
            const Icon = category.icon
            const count = category.id === 'all' ? visibleDocs.length : categoryCounts.get(category.id) ?? 0
            const isSelected = selectedCategoryId === category.id

            return (
              <button
                key={category.id}
                id={`document-category-tab-${category.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls="document-category-panel"
                onClick={() => setActiveCategory(category.id)}
                onKeyDown={event => {
                  const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
                  const currentIndex = tabs.indexOf(event.currentTarget)
                  const nextIndex = event.key === 'ArrowRight'
                    ? (currentIndex + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (currentIndex - 1 + tabs.length) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : null

                  if (nextIndex !== null) {
                    event.preventDefault()
                    tabs[nextIndex]?.focus()
                    setActiveCategory(categoryTabs[nextIndex].id)
                  }
                }}
                className={`flex min-w-[9rem] flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all     ${
                  isSelected
                    ? 'border-accent bg-accent text-accent-text shadow-md shadow-accent/15'
                    : 'border-transparent bg-surface/70 text-muted hover:border-border hover:bg-surface hover:text-text'
                }`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${isSelected ? 'bg-accent-text/15' : 'bg-surface-muted text-accent'}`}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{category.label}</span>
                  <span className={`mt-0.5 block text-xs ${isSelected ? 'text-accent-text' : 'text-muted'}`}>
                    {count} {count === 1 ? 'file' : 'files'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div
          id="document-category-panel"
          role="tabpanel"
          aria-labelledby={`document-category-tab-${selectedCategoryId}`}
          tabIndex={0}
        >
          {filteredDocs.length === 0 ? (
            <div className="card py-16 text-center text-muted">
              <EmptyLedger variant="documents" className="empty-illustration mx-auto mb-3" />
              <p className="font-semibold text-text">
                {visibleDocs.length === 0
                  ? createdByMe ? 'You have not uploaded a document yet.' : 'No documents recorded yet.'
                  : `No ${selectedCategoryTab?.label.toLowerCase() ?? 'category'} yet.`}
              </p>
              <p className="mt-1 text-sm text-muted">
                {visibleDocs.length === 0
                  ? 'Choose a category in the upload panel, then select a file to share.'
                  : 'Documents added to this category will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="card cursor-pointer hover:border-accent"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-3 bg-surface-muted rounded-lg shrink-0">
                    <FileText size={20} className="text-muted" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex min-w-0 items-center gap-2"><h3 className="min-w-0 truncate font-medium text-text transition-colors hover:text-accent">{doc.name}</h3><CreatorTag profile={doc.profiles} contributorName={doc.contributor_name} contributorTag={doc.contributor_tag} /></div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-accent/10 text-accent">
                        {getDocumentCategory(doc).label}
                      </span>
                      <span className="text-xs text-muted">{formatFileSize(doc.file_size)}</span>
                      <span className="text-xs text-muted">•</span>
                      <CreatorTag profile={doc.profiles} contributorName={doc.contributor_name} contributorTag={doc.contributor_tag} showName />
                      <span className="text-xs text-muted">•</span>
                      <span className="text-xs text-muted">
                        {new Date(doc.created_at).toLocaleDateString('en-UG', {
                          month: 'short',
                          day: 'numeric',
                          year: doc.created_at.startsWith(new Date().getFullYear().toString()) ? undefined : 'numeric',
                        })}
                      </span>
                      <span className="text-xs text-muted">
                        {doc.assigned_to?.length ? `Shared with ${doc.assigned_to.length} individual${doc.assigned_to.length === 1 ? '' : 's'}` : 'Available to everyone'}
                      </span>
                    </div>
                    {doc.description && (
                      <p className="text-sm text-muted mt-2">{doc.description}</p>
                    )}

                    {/* Inline confirm — expands below the doc meta */}
                    {deletingDocId === doc.id && (
                      <div className="mt-3">
                        <InlineConfirm
                          message={`Delete "${doc.name}"? This cannot be undone.`}
                          onConfirm={() => handleDelete(doc)}
                          onCancel={() => setDeletingDocId(null)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row sm:gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(doc)
                      }}
                      className="p-2 hover:bg-pink-accent/10 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download size={18} className="text-pink-text" />
                    </button>
                    {deletingDocId !== doc.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingDocId(doc.id)
                        }}
                        className="p-2 hover:bg-danger/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} className="text-danger" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
