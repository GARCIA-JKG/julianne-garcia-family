import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: {
    default: "Julianne's Garcia Family",
    template: "%s | Julianne's Garcia Family"
  },
  description:
    "A private family archive for preserving Garcia family photos, videos, voices, and stories.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="paper-texture" />
        <div className="site-shell">
          <SiteHeader />
          <main>{children}</main>
          <footer>
            <p>Made to preserve the stories that make a family.</p>
            <p className="footer-small">Julianne&apos;s Garcia Family</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
