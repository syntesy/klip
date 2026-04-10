import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Clerk reads session cookies at runtime — prevents static pre-render errors
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Klip — Sua comunidade, organizada pela IA",
  description: "A comunidade que se organiza sozinha.",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const body = (
    <html lang="pt-BR">
      {/* Inline script runs before paint — prevents light flash on dark-default app */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('klip-theme');if(s==='light'||s==='dark'){document.documentElement.setAttribute('data-theme',s);return;}if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.setAttribute('data-theme','light');}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-bg-page text-text-1 antialiased`}>
        {children}
      </body>
    </html>
  );

  if (!hasClerkKey) {
    // No Clerk key configured — run without auth (dev only)
    return body;
  }

  return <ClerkProvider>{body}</ClerkProvider>;
}
