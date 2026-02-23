import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "doc-factory",
  description: "Image-only A4 page preview and PPTX export",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
