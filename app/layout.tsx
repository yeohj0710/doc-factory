import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "doc-factory | A4 서비스 소개서 빌더",
  description:
    "로컬 이미지/폰트만으로 A4 소개서 페이지를 생성하고 편집 가능한 PPTX로 내보냅니다.",
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
