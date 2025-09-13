import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Digital Krishi Officer - Your Personal Farming Advisor",
  description:
    "AI-powered agricultural assistant supporting multiple Indian languages. Get expert farming advice, crop analysis, and agricultural guidance.",
  keywords: "agriculture, farming, AI assistant, crop advice, digital agriculture, krishi, farming advisor",
  authors: [{ name: "Digital Agriculture Team" }],
  viewport: "width=device-width, initial-scale=1",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
