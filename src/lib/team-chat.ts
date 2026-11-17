export type ChatResourceKind = 'document' | 'workspace' | 'task' | 'meeting'

export type ChatResource = {
  id: string
  kind: ChatResourceKind
  title: string
}

export type ChatMessage = {
  id: string
  author_id: string
  author_name: string
  body: string
  attachments: ChatResource[]
  created_at: string
}

const resourceKinds: ChatResourceKind[] = ['document', 'workspace', 'task', 'meeting']

export function parseChatResources(value: unknown): ChatResource[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): ChatResource[] => {
    if (!item || typeof item !== 'object') return []
    const resource = item as Record<string, unknown>
    if (
      typeof resource.id !== 'string'
      || typeof resource.title !== 'string'
      || typeof resource.kind !== 'string'
      || !resourceKinds.includes(resource.kind as ChatResourceKind)
    ) return []
    return [{ id: resource.id, kind: resource.kind as ChatResourceKind, title: resource.title }]
  })
}

export function chatResourceHref(resource: ChatResource) {
  switch (resource.kind) {
    case 'document':
      return `/api/documents/${encodeURIComponent(resource.id)}/access`
    case 'workspace':
      return `/dashboard/workspace?document=${encodeURIComponent(resource.id)}`
    case 'task':
      return `/dashboard/workspace?task=${encodeURIComponent(resource.id)}`
    case 'meeting':
      return '/dashboard/meetings'
  }
}

export function chatResourceLabel(kind: ChatResourceKind) {
  switch (kind) {
    case 'document': return 'Shared file'
    case 'workspace': return 'Workspace document'
    case 'task': return 'Task'
    case 'meeting': return 'Meeting'
  }
}
