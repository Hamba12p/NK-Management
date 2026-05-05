interface InlineConfirmProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  destructive?: boolean
}

/**
 * Renders an inline "Are you sure?" row in place of a delete button.
 * Parent controls visibility via a piece of state (e.g. `deletingId`).
 */
export default function InlineConfirm({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Delete',
  destructive = true,
}: InlineConfirmProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-rust/5 border border-rust/20 rounded-lg">
      <p className="text-sm text-ink flex-1">{message}</p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs font-medium border border-border rounded-lg hover:bg-warm transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            destructive
              ? 'bg-rust text-white hover:bg-rust/80'
              : 'bg-purple text-white hover:bg-purple-lt'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
