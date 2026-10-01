import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jhunnior Chat",
  description: "Tu espacio para pensar, crear y conversar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
