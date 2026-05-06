import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "배드민턴 대진표",
  description: "복식 대진표와 코트별 시간표를 생성하는 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="bg-zinc-950 text-zinc-100">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs sm:px-6 lg:px-8">
            <p className="font-semibold">배드민턴 대진표를 불러오는 중일 수 있습니다.</p>
            <p className="text-zinc-300">잠시만 기다려 주세요.</p>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
