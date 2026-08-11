'use client'
import { useState, useEffect } from 'react'
import { X, FileText, Loader, AlertCircle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
  profiles: { full_name: string }
}

type DocumentModalProps = {
  doc: Document | null
  onClose: () => void
  onSave: (updates: Partial<Document>) => Promise<void>
}

export default function DocumentModal({ doc, onClose, onSave }: DocumentModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedCategory, setEditedCategory] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClient()

  async function loadPreview(document: Document) {
    setLoading(true)
    setError('')
    setPreview(null)

    try {
      // Handle different file types
      const textTypes = ['text/plain', 'application/json', 'text/csv', 'text/html', 'text/xml']
      const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
      const isPDF = document.mime_type === 'application/pdf'
      const isText = textTypes.includes(document.mime_type) || document.name.endsWith('.txt')
      const isImage = imageTypes.includes(document.mime_type)

      if (!isText && !isPDF && !isImage) {
        setPreview(`[Preview not available for ${document.mime_type}]\nDownload to view this file type.`)
        setLoading(false)
        return
      }

      // For images, generate a signed URL for preview
      if (isImage) {
        const { data, error: err } = await supabase.storage
          .from('documents')
          .createSignedUrl(document.file_path, 3600)

        if (err) {
          setError(`Failed to load image: ${err.message}`)
          setLoading(false)
          return
        }

        if (data?.signedUrl) {
          setPreview(`[IMAGE:${data.signedUrl}]`)
        }
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase.storage
        .from('documents')
        .download(document.file_path)

      if (err) {
        setError(`Failed to load preview: ${err.message}`)
        setLoading(false)
        return
      }

      if (isText) {
        const text = await data.text()
        setPreview(text.substring(0, 5000) + (text.length > 5000 ? '\n\n[Preview truncated...]' : ''))
      } else if (isPDF) {
        setPreview('[PDF file - Download to view full content]')
      }
    } catch (err) {
      setError(`Error loading preview: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (doc) {
      // Synchronise editable fields when a different document is selected.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditedName(doc.name)
      setEditedDescription(doc.description || '')
      setEditedCategory(doc.category)
      loadPreview(doc)
    }
  }, [doc])

  async function handleOpenWithApp() {
    if (!doc) return
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 900)

      if (error) {
        setError(`Failed to open: ${error.message}`)
        return
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err) {
      setError(`Error opening file: ${err}`)
    }
  }

  async function handleSave() {
    if (!doc) return
    setIsSaving(true)
    try {
      await onSave({
        name: editedName,
        description: editedDescription,
        category: editedCategory as any,
      })
      setIsEditing(false)
    } catch (err) {
      setError(`Failed to save: ${err}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (!doc) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warm rounded-lg">
              <FileText size={20} className="text-gold" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">{doc.name}</h2>
              <p className="text-xs text-muted mt-1">{doc.profiles?.full_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Edit Form */}
          {isEditing && (
            <div className="space-y-4 pb-4 border-b border-border">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">Document Name</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">Description</label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">Category</label>
                <select
                  value={editedCategory}
                  onChange={(e) => setEditedCategory(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
                >
                  <option value="general">General</option>
                  <option value="policy">Policy</option>
                  <option value="report">Report</option>
                  <option value="template">Template</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
            </div>
          )}

          {/* Document Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted mb-1">Category</p>
              {isEditing ? null : (
                <p className="font-medium capitalize text-ink">{doc.category}</p>
              )}
            </div>
            <div>
              <p className="text-muted mb-1">Size</p>
              <p className="font-medium text-ink">
                {(doc.file_size / 1024).toFixed(2)} KB
              </p>
            </div>
            <div>
              <p className="text-muted mb-1">Type</p>
              <p className="font-medium text-ink">{doc.mime_type}</p>
            </div>
            <div>
              <p className="text-muted mb-1">Uploaded</p>
              <p className="font-medium text-ink">
                {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {doc.description && !isEditing && (
            <div>
              <p className="text-sm font-medium text-ink mb-2">Description</p>
              <p className="text-sm text-muted">{doc.description}</p>
            </div>
          )}

          {/* Preview */}
          <div>
            <p className="text-sm font-medium text-ink mb-2">Preview</p>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader size={20} className="animate-spin text-gold" />
              </div>
            ) : error ? (
              <div className="bg-rust/10 border border-rust rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-rust shrink-0 mt-0.5" />
                <p className="text-xs text-rust">{error}</p>
              </div>
            ) : preview ? (
              preview.startsWith('[IMAGE:') ? (
                <div className="bg-gray-50 rounded-lg p-4 border border-border flex items-center justify-center max-h-64">
                  <img
                    src={preview.slice(7, -1)}
                    alt={doc.name}
                    className="max-w-full max-h-60 rounded-lg object-contain"
                  />
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 border border-border max-h-48 overflow-y-auto font-mono text-xs text-ink whitespace-pre-wrap break-words">
                  {preview}
                </div>
              )
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-gray-50">
          <button
            onClick={() => setIsEditing(!isEditing)}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenWithApp}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gold text-gold hover:bg-gold/10 transition-colors flex items-center gap-2"
            >
              <ExternalLink size={16} />
              Open with App
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            {isEditing && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gold text-white hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
