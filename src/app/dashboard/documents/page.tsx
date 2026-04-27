'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, Download, Trash2, AlertCircle } from 'lucide-react'
import { z } from 'zod'

const uploadSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().default(''),
  category: z.enum(['general', 'policy', 'report', 'template', 'meeting']).default('general'),
})

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

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('general')
  const supabase = createClient()

  // Fetch documents
  async function fetchDocs() {
    try {
      const { data, error: err } = await supabase
        .from('documents')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })

      if (err) {
        console.error('Error fetching documents:', err)
        return
      }
      setDocs(data || [])
    } catch (e) {
      console.error('Fetch error:', e)
    }
  }

  useEffect(() => {
    fetchDocs()

    // REALTIME: listen for changes from other users
    const channel = supabase
      .channel('documents-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, fetchDocs)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setSuccess('')
    setUploading(true)

    try {
      // Validate file size client-side
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        setError('File too large. Maximum 50MB.')
        setUploading(false)
        return
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setUploading(false)
        return
      }

      // Upload to private bucket
      const sanitizedFileName = file.name.replace(/[^a-z0-9.\-_]/gi, '_')
      const filePath = `${user.id}/${Date.now()}-${sanitizedFileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        setUploading(false)
        return
      }

      // Save metadata to DB
      const { error: dbError } = await supabase.from('documents').insert({
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        category: selectedCategory,
        uploaded_by: user.id,
      })

      if (dbError) {
        setError(`Failed to save document: ${dbError.message}`)
        setUploading(false)
        return
      }

      setSuccess(`"${file.name}" uploaded successfully`)
      // Reset file input
      e.target.value = ''
    } catch (err) {
      setError(`Unexpected error: ${err}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(doc: Document) {
    try {
      // Create a signed URL that expires in 15 minutes
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 900) // 900 seconds = 15 minutes

      if (error) {
        setError(`Download failed: ${error.message}`)
        return
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err) {
      setError(`Download error: ${err}`)
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return

    try {
      setError('')
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path])

      if (storageError) {
        setError(`Failed to delete file: ${storageError.message}`)
        return
      }

      // Delete metadata from DB
      const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id)

      if (dbError) {
        setError(`Failed to delete record: ${dbError.message}`)
        return
      }

      setSuccess(`"${doc.name}" deleted`)
    } catch (err) {
      setError(`Delete error: ${err}`)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      general: 'bg-blue-50 text-blue-700',
      policy: 'bg-purple-50 text-purple-700',
      report: 'bg-green-50 text-green-700',
      template: 'bg-orange-50 text-orange-700',
      meeting: 'bg-pink-50 text-pink-700',
    }
    return colors[category] || colors.general
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
        <p className="text-gray-500">Upload and manage shared files</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white border-2 border-dashed border-pink-200 rounded-xl p-8 mb-6 hover:border-pink-400 transition-colors">
        <div className="flex flex-col items-center justify-center">
          <div className="mb-4 p-3 bg-pink-50 rounded-lg">
            <Upload size={24} className="text-pink-600" />
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload Document</h2>
          <p className="text-sm text-gray-500 mb-4">PDF, Word, Excel, Images (max 50MB)</p>

          <div className="flex gap-4 mb-4 w-full max-w-sm">
            <label className="flex-1">
              <span className="text-xs font-medium text-gray-600 block mb-2">Category</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
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
            <div className="bg-gradient-to-r from-pink-600 to-pink-700 text-white px-6 py-2.5 rounded-lg font-medium hover:from-pink-700 hover:to-pink-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-block">
              {uploading ? 'Uploading…' : 'Choose File'}
            </div>
          </label>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Error</h3>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {docs.length} {docs.length === 1 ? 'Document' : 'Documents'}
        </h2>

        {docs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-gray-500">No documents yet. Upload the first one.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* File Icon */}
                  <div className="p-3 bg-gray-100 rounded-lg shrink-0">
                    <FileText size={20} className="text-gray-500" />
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{doc.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${getCategoryColor(doc.category)} capitalize`}>
                        {doc.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatFileSize(doc.file_size)}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">
                        {doc.profiles?.full_name}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString('en-UG', {
                          month: 'short',
                          day: 'numeric',
                          year: doc.created_at.startsWith(new Date().getFullYear().toString()) ? undefined : 'numeric',
                        })}
                      </span>
                    </div>
                    {doc.description && (
                      <p className="text-sm text-gray-600 mt-2">{doc.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download size={18} className="text-blue-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} className="text-red-400" />
                    </button>
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
