import type { Metadata } from "next";
import "./globals.css";
import SwRegister from "./sw-register";

export const metadata: Metadata = {
  title: "Moments",
  description: "Digital photo frame — upload, display, enjoy",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#000" }}>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
