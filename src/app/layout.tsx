import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helpdesk RPA Automation",
  description: "Automated helpdesk ticket creation from Excel files",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
