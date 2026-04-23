import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fluency.",
  description: "Your personal English language coach",
  // הגדרות האייקונים החדשים שהעלית
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  // הגדרות למראה אפליקטיבי (PWA)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fluency.",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#FDFBF7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}