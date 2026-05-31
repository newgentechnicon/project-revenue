import { Geist_Mono, Noto_Sans_Thai } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/hooks/use-auth";
import { OrgProvider } from "@/hooks/use-org";
import { AppStateProvider } from "@/lib/context/app-state-context";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", notoSansThai.variable)}
    >
      <body>
        <ThemeProvider>
          <AuthProvider>
            <OrgProvider>
              <AppStateProvider>
                {children}
                <Toaster richColors position="top-right" closeButton />
              </AppStateProvider>
            </OrgProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
