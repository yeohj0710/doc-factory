import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "doc-factory | Generic Visual Document Builder",
  description:
    "Generate an editable visual document from /images, validate static/runtime gates, and export a safe PPTX.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
