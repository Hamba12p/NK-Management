import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col items-stretch justify-between gap-4 border-b border-border pb-5 sm:mb-8 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="mb-2 text-[.68rem] font-bold uppercase tracking-[.17em] text-accent">NK Udada Hub</p>
        <h1 className="serif-display mb-1 text-3xl text-text md:text-4xl">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      {action && <div className="w-full shrink-0 sm:ml-4 sm:w-auto">{action}</div>}
    </div>
  )
}
