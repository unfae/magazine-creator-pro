import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { ThemeProvider } from "@/components/theme-provider"

export function AppLayout() {
  useEffect(() => {
    // Prevent duplicate script injection...
    if ((window as any).clarity) return

    (function (c: any, l: Document, a: string, r: string, i: string) {
      c[a] = c[a] || function () {
        (c[a].q = c[a].q || []).push(arguments)
      }
      const t = l.createElement(r)
      t.async = true
      t.src = "https://www.clarity.ms/tag/" + i
      const y = l.getElementsByTagName(r)[0]
      y.parentNode?.insertBefore(t, y)
    })(window, document, "clarity", "script", "umjy45xnr8")
  }, [])

  return (
    <ThemeProvider defaultTheme="light" storageKey="magazine-theme">
      <div className="min-h-screen bg-background text-foreground transition-colors">
        <Header />
        <main className="animate-fade-in">
          <Outlet />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  )
}
