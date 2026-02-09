import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Yachai - Il tuo assistente per il benessere",
  description: "Monitora la tua salute, pelle, nutrizione ed emozioni con Yachai, l'assistente AI definitivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${figtree.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
