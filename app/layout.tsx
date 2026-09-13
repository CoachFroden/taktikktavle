import type { Metadata } from "next";
import TouchEnhancer from "./TouchEnhancer";
import PatternLibrary from "./PatternLibrary";
import "./globals.css";
import "./touch.css";
import "./patterns.css";

export const metadata: Metadata = {
  title: "Taktikktavle",
  description: "Digital taktikktavle for fotball",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="no">
      <body>
        {children}
        <TouchEnhancer />
        <PatternLibrary />
      </body>
    </html>
  );
}
