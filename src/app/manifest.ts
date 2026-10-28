import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'NK Udada Staff Hub',
    short_name: 'NK Hub',
    description: 'Collaborative platform for NK Foundation staff',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#F8F4F1',
    theme_color: '#782653',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
