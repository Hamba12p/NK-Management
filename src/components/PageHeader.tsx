import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <p className="mb-2 text-[.68rem] font-bold uppercase tracking-[.17em] text-gold">NK Udada Hub</p>
        <h1 className="serif-display mb-1 text-3xl text-ink md:text-4xl">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  )
}
