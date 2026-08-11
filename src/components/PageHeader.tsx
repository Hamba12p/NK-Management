import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8 rounded-2xl bg-ink px-6 py-5 text-cream">
      <div>
        <h1 className="text-3xl font-bold text-cream serif-display mb-1">{title}</h1>
        {description && (
          <p className="text-white/65 text-sm">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 ml-6">{action}</div>}
    </div>
  )
}
