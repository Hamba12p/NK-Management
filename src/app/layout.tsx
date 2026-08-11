import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NK Udada Staff Hub',
  description: 'Collaborative platform for NK Foundation staff',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
