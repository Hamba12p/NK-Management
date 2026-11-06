'use client'

import type { StaffDirectoryEntry } from '@/lib/staff-directory'
import { formatProfileRole } from '@/lib/utils'

type DocumentAssigneePickerProps = {
  assignees: StaffDirectoryEntry[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  disabled?: boolean
  unassignedMessage?: string
}

export default function DocumentAssigneePicker({
  assignees,
  selectedIds,
  onChange,
  disabled = false,
  unassignedMessage = 'Leave everyone unselected to make this document available to everyone allowed by its existing visibility settings.',
}: DocumentAssigneePickerProps) {
  function toggleAssignee(id: string) {
    onChange(selectedIds.includes(id)
      ? selectedIds.filter(selectedId => selectedId !== id)
      : [...selectedIds, id])
  }

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="block text-sm font-medium text-text mb-2">Share with individuals</legend>
      <p className="text-xs text-muted">{unassignedMessage}</p>
      {assignees.length === 0 ? (
        <p className="text-sm text-muted">No individuals available.</p>
      ) : (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {assignees.map(assignee => (
            <label key={assignee.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text hover:bg-surface-muted/60">
              <input
                type="checkbox"
                checked={selectedIds.includes(assignee.id)}
                onChange={() => toggleAssignee(assignee.id)}
                className="h-4 w-4 rounded border-border"
              />
              <span>{assignee.full_name}</span>
              {formatProfileRole(assignee.full_name, assignee.role) && <span className="ml-auto text-xs capitalize text-muted">{formatProfileRole(assignee.full_name, assignee.role)}</span>}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}
