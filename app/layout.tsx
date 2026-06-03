import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gemini Trading Suite",
  description: "AI trading research workspace powered by Google Gemini.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
