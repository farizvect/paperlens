import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { StoreHydrator } from "@/components/store-hydrator";

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PaperLens",
  description: "Upload scientific PDFs and chat with AI about their content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-serif)]">
        <StoreHydrator />
        {children}
      </body>
    </html>
  );
}
