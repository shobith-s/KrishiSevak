import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Digital Krishi Officer - Your Personal Farming Advisor",
  description:
    "AI-powered agricultural assistant supporting multiple Indian languages. Get expert farming advice, crop analysis, and agricultural guidance.",
  keywords: "agriculture, farming, AI assistant, crop advice, digital agriculture, krishi, farming advisor",
  authors: [{ name: "Digital Agriculture Team" }],
  viewport: "width=device-width, initial-scale=1",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
