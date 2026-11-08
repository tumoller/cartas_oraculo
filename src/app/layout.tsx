import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import "@/styles/editorial.css";

// Fontes do visual editorial (início, mapa astral e numerologia). As cartas mantêm o visual próprio.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const text = Inter({ subsets: ["latin"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Oráculo Cósmico | Baralho Cigano, Mapa Astral e Numerologia", template: "%s | Oráculo Cósmico" },
  description: "Baralho Cigano, mapa astral e numerologia com leitura personalizada.",
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
    <html lang="pt-BR" className={`${display.variable} ${text.variable}`}>
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-purple-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
