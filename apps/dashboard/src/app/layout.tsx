import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import { ShieldAlert } from "lucide-react";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vigil | Agentic API Watchdog",
  description: "Detects vendor API changes and opens verified sandboxed PRs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${firaCode.variable} antialiased`}>
        {/* Top Navigation */}
        <header className="sticky top-0 z-50 w-full glass-panel border-b-0 border-glass-border">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 border border-glass-border shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                <ShieldAlert className="h-5 w-5 text-accent-cyan" />
              </div>
              <span className="font-bold text-xl tracking-tight text-foreground">
                Vigil
              </span>
            </div>
            
            <nav className="hidden md:flex gap-6 text-sm font-medium text-muted">
              <a href="#" className="text-foreground transition-colors">Change Feed</a>
              <a href="#" className="hover:text-foreground transition-colors">Installations</a>
              <a href="#" className="hover:text-foreground transition-colors">Settings</a>
            </nav>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-glass-bg border border-glass-border text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
                System Online
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          {children}
        </main>
      </body>
    </html>
  );
}
