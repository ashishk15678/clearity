import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import { TRPCReactProvider } from "@/trpc/client";
import "./globals.css";
import { cn } from "@/lib/cn";
import { Toaster } from "@/components/ui/sonner";
import { Topbar } from "@/components/dashboard/topbar";
import { ThemeProvider } from "@/components/theme-provider";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clarity",
  description: "Clarity app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        figtree.variable,
      )}
    >
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <body className="min-h-full flex flex-col">
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster />
        </body>
      </ThemeProvider>
    </html>
  );
}
