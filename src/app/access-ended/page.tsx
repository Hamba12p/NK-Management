import Link from 'next/link'
import PushCleanupNotice from './push-cleanup-notice'

export default async function AccessEndedPage({
  searchParams,
}: {
  searchParams: Promise<{ 'push-cleanup'?: string }>
}) {
  const params = await searchParams
  return <main className="page-container mx-auto max-w-lg px-4 py-20">
    <section className="card text-center">
      <h1 className="serif-display text-3xl text-ink">Your access has ended</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Your temporary access to the NK Udada Staff Hub has ended. Please contact your supervisor if you need further access.</p>
      <PushCleanupNotice serverCleanupFailed={params['push-cleanup'] === 'failed'} />
      <Link href="/login" className="btn-secondary mt-6 inline-flex">Return to sign in</Link>
    </section>
  </main>
}
