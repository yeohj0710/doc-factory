import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "doc-factory | 맞춤 건기식 B2B 소개서 빌더",
  description:
    "로컬 이미지/폰트만으로 맞춤 건기식 B2B 서비스 소개서를 생성하고 편집 가능한 A4 PPTX로 내보냅니다.",
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
