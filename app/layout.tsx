import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Le Bassamba — RestoCMD',
  description: 'Système de gestion des commandes — Le Bassamba',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
