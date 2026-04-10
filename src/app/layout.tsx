import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ui/theme-provider";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "DuckReports — Job Application Assistant",
  description: "Track and manage your job applications with AI-assisted responses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (

    <html lang="en" className={cn("h-full antialiased", "font-sans", inter.variable)} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >{children}
            </ThemeProvider></body>
    </html>
  );
}
