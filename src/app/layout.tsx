// src/app/layout.tsx
import { Inter, Oswald, Limelight } from "next/font/google";
import type { Viewport } from "next";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-body",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

const limelight = Limelight({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-retro",
});

import "../styles/globals.css";

// Export viewport configuration
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata = {
  title: "Deep Learning Course | CSCI 1470",
  description: "Welcome to the Deep Learning Diner - CSCI 1470 @ Brown University",
  icons: {
    icon: "/images/icons/logo.png",
  },
};

import StyledComponentsRegistry from "../lib/registry";
import ClickSizzleProvider from "./components/ClickSizzleProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${oswald.variable} ${limelight.variable}`}
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
      </head>
      <body>
        <StyledComponentsRegistry>
          <ClickSizzleProvider>{children}</ClickSizzleProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
