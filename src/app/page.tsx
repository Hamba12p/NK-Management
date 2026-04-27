export default function Home() {
  const features = [
    { title: 'Next.js 14', status: '✓', desc: 'React with App Router & TypeScript' },
    { title: 'Tailwind CSS', status: '✓', desc: 'Styling framework' },
    { title: 'Supabase Integration', status: '✓', desc: 'Client & server setup ready' },
    { title: 'Security Headers', status: '✓', desc: 'CSP, HSTS, X-Frame-Options' },
    { title: 'Route Middleware', status: '✓', desc: 'Auth protection configured' },
    { title: 'Environment Setup', status: '✓', desc: 'Template ready (.env.local.example)' },
    { title: 'Activity Logging', status: '✓', desc: 'Audit trail utility' },
    { title: 'GitHub Actions', status: '✓', desc: 'Security audit workflow' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <h1 className="text-5xl font-bold text-slate-900 mb-3">
            NK Udada Hub
          </h1>
          <p className="text-xl text-slate-600">Phase 0 — Foundation Setup Complete</p>
          <div className="mt-4 inline-block bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <p className="text-green-700 font-medium">✓ All configurations ready</p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {features.map((feature) => (
            <div key={feature.title} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <span className="text-2xl text-green-600 font-bold">{feature.status}</span>
                <div>
                  <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                  <p className="text-sm text-slate-500">{feature.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Next Steps */}
        <div className="bg-white border-2 border-pink-200 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Next Steps</h2>
          <ol className="space-y-3 text-slate-700">
            <li className="flex gap-3">
              <span className="font-bold text-pink-600 min-w-6">1</span>
              <span>Copy <code className="bg-slate-100 px-2 py-1 rounded text-sm">.env.local.example</code> to <code className="bg-slate-100 px-2 py-1 rounded text-sm">.env.local</code></span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-pink-600 min-w-6">2</span>
              <span>Create a Supabase project at <a href="https://supabase.com" className="text-pink-600 hover:underline" target="_blank" rel="noopener noreferrer">supabase.com</a> (Region: South Africa/Cape Town)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-pink-600 min-w-6">3</span>
              <span>Add your Supabase credentials to <code className="bg-slate-100 px-2 py-1 rounded text-sm">.env.local</code></span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-pink-600 min-w-6">4</span>
              <span>Run <code className="bg-slate-100 px-2 py-1 rounded text-sm">npm run dev</code> and proceed to Phase 1</span>
            </li>
          </ol>
        </div>

        {/* Documentation Links */}
        <div className="grid md:grid-cols-2 gap-4">
          <a href="/PHASE_0_README.md" className="block bg-slate-900 text-white rounded-lg p-6 hover:bg-slate-800 transition-colors">
            <h3 className="font-bold mb-2">📖 Phase 0 Documentation</h3>
            <p className="text-sm text-slate-300">Complete setup guide and project structure</p>
          </a>
          <div className="bg-slate-100 text-slate-900 rounded-lg p-6">
            <h3 className="font-bold mb-2">🔐 Security Baseline</h3>
            <p className="text-sm text-slate-600">10-layer defense: TLS, magic links, RLS, JWT, signed URLs, validation, CSP, audit logs, zero secrets, supply chain audit</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-slate-500 text-sm">
          <p>NK Udada Foundation — Empower & Equip</p>
          <p className="mt-1">Ready to build Phase 1: Authentication & User Management</p>
        </div>
      </div>
    </div>
  )
}
