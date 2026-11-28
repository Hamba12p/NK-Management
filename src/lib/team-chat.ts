export type ChatResourceKind = 'document' | 'workspace' | 'task' | 'meeting'
export type DashboardResourceKind = ChatResourceKind | 'announcement'

export function dashboardResourceHref(kind: DashboardResourceKind, id: string) {
  const encodedId = encodeURIComponent(id)
  switch (kind) {
    case 'document':
      return `/dashboard/documents?document=${encodedId}`
    case 'workspace':
      return `/dashboard/workspace?document=${encodedId}`
    case 'task':
      return `/dashboard/workspace?task=${encodedId}`
    case 'meeting':
      return `/dashboard/meetings?meeting=${encodedId}`
    case 'announcement':
      return `/dashboard/announcements?announcement=${encodedId}`
  }
}

export type ChatResource = {
  id: string
  kind: ChatResourceKind
  title: string
}

const resourceKinds: ChatResourceKind[] = ['document', 'workspace', 'task', 'meeting']

export function parseChatResources(value: unknown): ChatResource[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 5).flatMap((item): ChatResource[] => {
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
  return dashboardResourceHref(resource.kind, resource.id)
}

export function chatResourceLabel(kind: ChatResourceKind) {
  switch (kind) {
    case 'document': return 'Shared file'
    case 'workspace': return 'Workspace document'
    case 'task': return 'Task'
    case 'meeting': return 'Meeting'
  }
}
