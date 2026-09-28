import type { Metadata } from "next";
import TwinklingStarsCursor from "@/components/edu/twinkling-stars-cursor";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduVoice AI | Your Personal Voice Learning Companion",
  description: "Learn, speak, practice, and grow with your multilingual AI voice tutor.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><TwinklingStarsCursor/>{children}</body>
    </html>
  );
}
