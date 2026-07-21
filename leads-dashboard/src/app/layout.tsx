import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "leads.mongodb.help",
  description: "Lead-gen admin dashboard for mongodb.help",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
