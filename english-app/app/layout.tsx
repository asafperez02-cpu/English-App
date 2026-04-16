import './globals.css'
import type { Viewport } from 'next'

// זה החלק שחוסם את הזום ומגדיר את שורת הסטטוס בטלפון
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata = {
  title: 'Step by Step',
  description: 'Legal English Mastery',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Step by Step',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* מונע מהמשתמש לעשות זום ידני שעלול להרוס את הממשק */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
      </head>
      <body>{children}</body>
    </html>
  )
}