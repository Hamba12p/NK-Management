'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import InlineConfirm from '@/components/InlineConfirm'
import DocumentModal from '@/components/DocumentModal'
import { Upload, FileText, Download, Trash2, AlertCircle } from 'lucide-react'
import { logActivity } from '@/lib/activity'
import { archiveAndDeleteContent } from '@/lib/content-deletion'
import CreatorTag from '@/components/CreatorTag'
import { EmptyLedger } from '@/components/BrandIllustrations'
import { volunteerContributor } from '@/lib/creator'

type Document = {
  id: string
  name: string
  description: string
  file_path: string
  file_size: number
  mime_type: string
  category: string
  created_at: string
  uploaded_by: string
  contributor_name: string | null
  contributor_tag: string | null
  profiles: { full_name: string; display_tag: string | null; display_color: string | null }
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('general')
  // Inline confirm: stores id of doc pending deletion
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [createdByMe, setCreatedByMe] = useState(false)
  const supabase = createClient()

  async function fetchDocs() {
    try {
      const [{ data, error: err }, { data: authData }] = await Promise.all([supabase
        .from('documents')
        .select('*, profiles!documents_uploaded_by_fkey(*)')
        .order('created_at', { ascending: false }), supabase.auth.getUser()])

      if (err) { console.error('Error fetching documents:', err); return }
      setDocs(data || [])
      setCurrentUserId(authData.user?.id || '')
    } catch (e) {
      console.error('Fetch error:', e)
    }
  }

  useEffect(() => {
    // Initial hydration deliberately updates local state after the first query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocs()

    const channel = supabase
      .channel('documents-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, fetchDocs)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

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
      const filePath = `${user.id}/${Date.now()}-${sanitizedFileName}`

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
        ...volunteerContributor(),
      })

      if (dbError) { setError(`Failed to save document: ${dbError.message}`); setUploading(false); return }

      logActivity('document.upload', 'document', undefined, { name: file.name, category: selectedCategory })

      setSuccess(`"${file.name}" uploaded successfully`)
      e.target.value = ''
    } catch (err) {
      setError(`Unexpected error: ${err}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(doc: Document) {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 900)

      if (error) { setError(`Download failed: ${error.message}`); return }
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch (err) {
      setError(`Download error: ${err}`)
    }
  }

  async function handleDelete(doc: Document) {
    try {
      setError('')
      await archiveAndDeleteContent(supabase, 'document', doc.id)

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
      const { error: err } = await supabase
        .from('documents')
        .update({
          name: updates.name,
          description: updates.description,
          category: updates.category,
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

  return (
    <div>
      <PageHeader title="Documents" description="Upload and access shared files" />

      {/* Modal */}
      <DocumentModal
        doc={selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onSave={handleSaveDocument}
      />

      {/* Upload Section */}
      <div className="card mb-6 border-dashed bg-cream p-8 hover:border-purple-lt">
        <div className="flex flex-col items-center justify-center">
          <div className="mb-4 p-3 bg-warm rounded-lg">
            <Upload size={24} className="text-gold" />
          </div>
          <h2 className="text-lg font-semibold text-ink mb-2">Upload Document</h2>
          <p className="text-sm text-muted mb-4">PDF, Word, Excel, Images (max 50MB)</p>

          <div className="flex gap-4 mb-4 w-full max-w-sm">
            <label className="flex-1">
              <span className="text-xs font-medium text-ink block mb-2">Category</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
              >
                <option value="general">General</option>
                <option value="policy">Policy</option>
                <option value="report">Report</option>
                <option value="template">Template</option>
                <option value="meeting">Meeting</option>
              </select>
            </label>
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
            />
            <div className="btn-primary">
              {uploading ? 'Uploading…' : 'Choose File'}
            </div>
          </label>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-rust/10 border border-rust rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-rust shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-rust">Error</h3>
            <p className="text-sm text-rust mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-700 font-medium">{success}</p>
        </div>
      )}

      {/* Documents List */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-ink">{visibleDocs.length} {visibleDocs.length === 1 ? 'Document' : 'Documents'}</h2><label className="flex items-center gap-2 text-sm font-semibold text-muted"><input type="checkbox" checked={createdByMe} onChange={event => setCreatedByMe(event.target.checked)} /> Created by me</label></div>

        {visibleDocs.length === 0 ? (
          <div className="text-center py-16 text-muted card">
            <EmptyLedger variant="documents" className="empty-illustration mx-auto mb-3" />
            <p className="font-semibold text-ink">{createdByMe ? 'You have not uploaded a document yet.' : 'No documents recorded yet.'}</p><p className="mt-1 text-sm text-muted">Choose a category above, then select a file to share.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleDocs.map((doc) => (
              <div
                key={doc.id}
                className="card cursor-pointer hover:border-purple"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-warm rounded-lg shrink-0">
                    <FileText size={20} className="text-muted" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex min-w-0 items-center gap-2"><h3 className="min-w-0 truncate font-medium text-ink transition-colors hover:text-purple">{doc.name}</h3><CreatorTag profile={doc.profiles} contributorName={doc.contributor_name} contributorTag={doc.contributor_tag} /></div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-medium px-2 py-1 rounded-full capitalize bg-purple/10 text-purple">
                        {doc.category}
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

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(doc)
                      }}
                      className="p-2 hover:bg-gold/10 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download size={18} className="text-gold" />
                    </button>
                    {deletingDocId !== doc.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingDocId(doc.id)
                        }}
                        className="p-2 hover:bg-rust/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} className="text-rust" />
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
  )
}
