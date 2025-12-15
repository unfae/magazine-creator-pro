import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { ThemeProvider } from "@/components/theme-provider";

export function AppLayout() {
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
  );
}
