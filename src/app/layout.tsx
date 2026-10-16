import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NK Udada Staff Hub',
  description: 'Collaborative platform for NK Foundation staff',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/logo.jpeg',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Staff Hub',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#f8f8f8',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="bg-background">{children}</body>
    </html>
  )
}
