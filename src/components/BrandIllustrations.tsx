export function EmptyLedger({ variant = 'ledger', className = '' }: { variant?: 'ledger' | 'documents' | 'tasks'; className?: string }) {
  return (
    <svg viewBox="0 0 180 120" className={className} fill="none" aria-hidden="true">
      <path d="M30 90c19-8 40-8 60 0 20-8 41-8 60 0V35c-18-7-39-7-60 2-21-9-42-9-60-2z" fill="var(--cream)" stroke="var(--purple)" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M90 37v53M40 47c14-4 27-3 40 1M40 58c12-3 25-2 38 1M100 48c14-5 27-5 40-1M100 59c12-4 25-4 38-1" stroke="var(--purple-lt)" strokeWidth="1.5" strokeLinecap="round"/>
      {variant === 'documents' && <path d="M116 27h25l9 9v33h-34zM141 27v10h9" fill="var(--warm)" stroke="var(--rust)" strokeWidth="1.5" strokeLinejoin="round"/>}
      {variant === 'tasks' && <><path d="M112 30h31v42h-31z" fill="var(--warm)" stroke="var(--purple)" strokeWidth="1.5"/><path d="m118 42 3 3 5-7M130 42h7M118 56h19" stroke="var(--rust)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>}
      {variant === 'ledger' && <path d="m48 85 69-55 4 5-61 61z" fill="var(--warm)" stroke="var(--rust)" strokeWidth="1.5" strokeLinejoin="round"/>}
      <path d="M22 98h136" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function LoginMotif() {
  return <div className="login-motif" aria-hidden="true"><span/><span/><span/><span/></div>
}
