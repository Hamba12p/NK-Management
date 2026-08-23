type DocumentAccess = {
  signedUrl: string
  name: string
  mimeType: string
  expiresIn: number
}

export async function getDocumentAccess(documentId: string): Promise<DocumentAccess> {
  const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/access`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null) as Partial<DocumentAccess> & { error?: string } | null

  if (!response.ok || !result?.signedUrl) {
    throw new Error(result?.error || 'Unable to open this document')
  }

  return {
    signedUrl: result.signedUrl,
    name: result.name || '',
    mimeType: result.mimeType || 'application/octet-stream',
    expiresIn: result.expiresIn || 0,
  }
}
