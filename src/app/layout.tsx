import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans_Arabic, Scheherazade_New } from "next/font/google"
import "./globals.css"
import Nav from "@/components/nav"
import { AppShell } from "@/components/app-shell"

/* UI font — premium neutral Arabic */
const ibmPlex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ui",
})

/* Serif / display font — Quran text + headings */
const scheherazade = Scheherazade_New({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-serif",
})

export const metadata: Metadata = {
  title: "حفظ",
  description: "رفيق الحفظ اليومي",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "حفظ" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F1EBDF",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${ibmPlex.variable} ${scheherazade.variable}`}>
      <body className="min-h-dvh app-body">
        <AppShell>
          <main>{children}</main>
          <Nav />
        </AppShell>
      </body>
    </html>
  )
}
