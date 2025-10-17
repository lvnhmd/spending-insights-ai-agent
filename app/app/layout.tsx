import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spending Insights AI Agent',
  description: 'Transform your spending data into actionable weekly money wins',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  )
}