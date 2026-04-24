import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fluency.",
  description: "Your personal English language coach",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fluency.",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/logo.png",
    // ה-v=2 בסוף שובר את הזיכרון של האייפון ומכריח אותו למשוך את התמונה
    apple: "/logo.png?v=2", 
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
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}