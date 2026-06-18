import "@/styles/globals.css";
import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "@/app/_components/theme-provider";
import { ToastProvider } from "@/app/_components/ui/toast";

export const metadata: Metadata = {
  title: "Singularity - Email & Calendar Reimagined",
  description:
    "A Superhuman-style Gmail and Google Calendar workflow app. Manage emails, schedule meetings, and automate your workflow with AI.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <TRPCReactProvider>
            <ToastProvider>{children}</ToastProvider>
          </TRPCReactProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
