import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header, Footer } from "@/components/layout";
import { CartProvider } from "@/components/cart";
import { env } from "@/lib/env";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: "Palmas TO — Servidor de roleplay e mods para FiveM", template: "%s · Palmas TO" },
  description:
    "Comunidade Palmas TO: servidor de roleplay inspirado em Palmas, Tocantins, e catálogo de mods, scripts, mapas e recursos para FiveM.",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Palmas TO" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0b0f14", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="flex min-h-screen flex-col">
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <CartProvider>
          <Header />
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
