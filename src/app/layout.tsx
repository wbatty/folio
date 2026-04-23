import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { PrivacyProvider } from "@/lib/privacy-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Folio — Job Application Tracker",
  description: "Track and manage your job applications with AI-assisted responses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    
    <html lang="en" className="h-full antialiased font-sans" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          <PrivacyProvider>
            {children}
          </PrivacyProvider>
        </ThemeProvider></body>
    </html>
  );
}
