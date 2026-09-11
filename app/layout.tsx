import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Montserrat } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { OfflineSyncProvider } from "@/components/offline-sync-provider";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600"] });
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "600", "800", "900"],
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["300", "400", "600"],
});

export const metadata: Metadata = {
  title: "Hilaac — Business intelligence for Somali restaurants",
  description:
    "QR ordering, live kitchen ops, AI chatbot, inventory, and P&L — built for Somali restaurants. Goronyo, Gorgor, Galeyr, and Somali Airlines plans.",
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
  // Google Search Console — content token only (not the full <meta> HTML string).
  verification: {
    google: "upyzLjyhHRlmAKLA_zLXatlB9wri6sUSHN52C3IyOcw",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${montserrat.variable} ${cormorant.variable} font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <LocaleProvider>
            <OfflineSyncProvider>{children}</OfflineSyncProvider>
            <Toaster richColors position="top-center" />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
