import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oráculo Cósmico | Baralho Cigano Lenormand",
  description:
    "Tiragem de cartas do Baralho Cigano com leitura oracular combinada e temática universal.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-purple-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
