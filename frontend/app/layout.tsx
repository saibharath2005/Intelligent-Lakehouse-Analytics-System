import type { Metadata } from "next"
import { inter, jetbrainsMono } from "@/lib/fonts"
import "./globals.css"
import { ToastProvider } from "@/components/ui/ToastProvider"
import { ThemeProvider } from "@/context/ThemeContext"
import ThemeBodyWrapper from "@/components/layout/ThemeBodyWrapper"

export const metadata: Metadata = {
  title: "InsightLake AI",
  description: "AI-powered data analysis and dashboard generation",
  authors: { name: "Gowtham Nutukurthi" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ToastProvider>
          <ThemeProvider>
            <ThemeBodyWrapper>
              {children}
            </ThemeBodyWrapper>
          </ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
