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

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const body = (
    <html lang="pt-BR">
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
