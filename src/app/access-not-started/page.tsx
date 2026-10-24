import Link from 'next/link'

export default function AccessNotStartedPage() {
  return <main className="page-container mx-auto max-w-lg px-4 py-20">
    <section className="card text-center">
      <h1 className="serif-display text-3xl text-ink">Your access has not started</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Your temporary NK Udada Staff Hub access will open on your agreed start date. Please contact your supervisor if you need help.</p>
      <Link href="/login" className="btn-secondary mt-6 inline-flex">Return to sign in</Link>
    </section>
  </main>
}
