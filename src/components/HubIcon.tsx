import type { SVGProps } from 'react'

export type HubIconName = 'home' | 'documents' | 'announcements' | 'workspace' | 'settings' | 'meetings' | 'team' | 'volunteers' | 'classes' | 'learners' | 'equipment' | 'activity' | 'advanced' | 'analytics' | 'dpo-register' | 'dpo-requests' | 'dpo-incidents' | 'profile' | 'hours'

const paths: Record<HubIconName, React.ReactNode> = {
  home: <><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5M10 20v-6h4v6"/></>,
  documents: <><path d="M6 3.5h8l4 4V21H6z"/><path d="M14 3.5V8h4M9 12h6M9 15.5h6"/></>,
  announcements: <><path d="M7.5 17h9M9 20h6"/><path d="M6.5 16c1-1 1.5-2.5 1.5-5a4 4 0 0 1 8 0c0 2.5.5 4 1.5 5z"/><path d="M12 4V2.5"/></>,
  workspace: <><path d="M5 4h14v16H5z"/><path d="M8 4v16M11 8h5M11 12h5M11 16h3"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4"/></>,
  meetings: <><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 4.5V2.5M19.5 12h2M12 19.5v2M4.5 12h-2"/></>,
  team: <><circle cx="12" cy="7.5" r="2.3"/><circle cx="6" cy="11" r="2"/><circle cx="18" cy="11" r="2"/><path d="M8 19c.4-3 1.8-4.5 4-4.5s3.6 1.5 4 4.5M2.8 19c.2-2.6 1.3-4 3.2-4 1 0 1.8.3 2.4 1M21.2 19c-.2-2.6-1.3-4-3.2-4-1 0-1.8.3-2.4 1"/></>,
  volunteers: <><path d="M12 20c-4-2.4-7-5.2-7-9a3.7 3.7 0 0 1 6.6-2.3L12 9l.4-.3A3.7 3.7 0 0 1 19 11c0 3.8-3 6.6-7 9Z"/><path d="m9.5 12 1.5 1.5 3.5-4"/></>,
  classes: <><path d="M4 5h16v15H4zM8 3v4M16 3v4M4 9h16"/><path d="M8 13h3M13 13h3M8 17h3"/></>,
  learners: <><path d="m3 9 9-5 9 5-9 5z"/><path d="M7 12v4c2.5 2 7.5 2 10 0v-4M21 9v6"/></>,
  equipment: <><rect x="4" y="4" width="16" height="11" rx="1"/><path d="M9 20h6M12 15v5"/></>,
  activity: <><path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z"/><circle cx="12" cy="12" r="2.2"/></>,
  advanced: <><path d="M5 6h14v14H5zM8 3h8v3"/><path d="M8.5 10h7M8.5 14h7M8.5 18h4"/></>,
  analytics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  'dpo-register': <><path d="M12 3 19 6v5c0 4.5-2.5 7.5-7 10-4.5-2.5-7-5.5-7-10V6z"/><path d="M9 9h6M9 12h6M9 15h3"/></>,
  'dpo-requests': <><path d="M6 4h12v16H6zM9 8h6M9 12h4"/><path d="m14 16 1.5 1.5L19 14"/></>,
  'dpo-incidents': <><path d="m12 3 9 17H3z"/><path d="M12 9v5M12 17.5v.1"/></>,
  profile: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.5-5 2.8-7.5 7-7.5s6.5 2.5 7 7.5"/></>,
  hours: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
}

export default function HubIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: HubIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
