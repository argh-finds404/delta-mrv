import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { RegisterServiceWorker } from "@/src/components/site/RegisterServiceWorker";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// opsz: large display sizes get the display cut of the face, body sizes the text cut.
const newsreader = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Delta",
  description: "Delta makes the evidence, the reviewer, and the review itself checkable by a stranger with a browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${newsreader.variable}`}
    >
      <body className="antialiased min-h-screen bg-field-abyss text-field-text">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}

