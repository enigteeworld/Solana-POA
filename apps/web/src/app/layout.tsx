import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/components/app-providers";
import { TopNav } from "@/components/top-nav";
import { BottomNav } from "@/components/bottom-nav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen transition-colors duration-300">
        <ThemeProvider>
          <AppProviders>
            <div className="min-h-screen">
              <TopNav />
              <main className="container-page pt-6 pb-24">
                {children}
              </main>
              <BottomNav />
            </div>
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}