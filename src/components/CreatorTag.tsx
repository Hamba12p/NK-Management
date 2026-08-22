import { CreatorProfile, initials } from '@/lib/creator'

type Props = {
  profile?: CreatorProfile | null
  contributorName?: string | null
  contributorTag?: string | null
  showName?: boolean
}

export default function CreatorTag({ profile, contributorName, contributorTag, showName = false }: Props) {
  const name = contributorName || profile?.full_name || 'Team member'
  const tag = (contributorTag || profile?.display_tag || initials(name)).slice(0, 4).toUpperCase()
  const color = profile?.display_color || 'burgundy'

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={`Created by ${name}`}>
      <span className="creator-tag" data-color={color} aria-hidden="true">{tag}</span>
      {showName && <span className="truncate text-xs text-muted">{name}</span>}
      <span className="sr-only">Created by {name}</span>
    </span>
  )
}
