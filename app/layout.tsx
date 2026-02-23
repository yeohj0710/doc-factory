import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "doc-factory | A4 문서 페이지 빌더",
  description: "이미지 기반 A4 페이지 미리보기와 편집 가능한 PPTX 내보내기",
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
