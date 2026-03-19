import type { Metadata } from "next";
import { Sora, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/toast";
import { OperationProvider } from "@/components/operation-provider";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "taimumashin",
  description: "Put your memories on ice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <SessionProvider>
            <ToastProvider>
              <OperationProvider>
                {children}
              </OperationProvider>
            </ToastProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
