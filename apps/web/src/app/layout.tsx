import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

// Clerk reads session cookies at runtime — prevents static pre-render errors
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Klip — Sua comunidade, organizada pela IA",
  description: "A comunidade que se organiza sozinha.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-167.png", sizes: "167x167", type: "image/png" },
      { url: "/icons/icon-120.png", sizes: "120x120", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Klip",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#08111f",
};

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const body = (
    <html lang="pt-BR" className={`${plusJakartaSans.variable} ${dmMono.variable}`}>
      {/* Inline script runs before paint — prevents light flash on dark-default app */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('klip-theme');if(s==='light'||s==='dark'){document.documentElement.setAttribute('data-theme',s);return;}if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.setAttribute('data-theme','light');}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        {/* Plausible — analytics LGPD-friendly, sem cookies */}
        <script
          defer
          data-domain="digitalklip.com"
          src="https://plausible.io/js/pa-TvK3tEPweTe_pBDglp8HM.js"
        />
      </head>
      <body className={`${plusJakartaSans.variable} ${dmMono.variable} bg-bg-page text-text-1 antialiased`} style={{ fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui, sans-serif)" }}>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );

  if (!hasClerkKey) {
    // No Clerk key configured — run without auth (dev only)
    return body;
  }

  return <ClerkProvider>{body}</ClerkProvider>;
}
