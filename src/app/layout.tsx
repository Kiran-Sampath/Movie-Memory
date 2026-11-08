import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// next/font downloads these at build time and serves them from our own
// server, so the browser never makes a request to Google for fonts.
const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Movie Memory",
  description: "Your favorite film, and a fun fact about it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <header className="border-b border-line">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <Link
              href="/"
              className="text-sm font-semibold uppercase tracking-[0.2em] text-fg"
            >
              Movie Memory
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4">{children}</main>
      </body>
    </html>
  );
}
