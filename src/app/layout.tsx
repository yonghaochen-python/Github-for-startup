import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { MobileTabBar, Nav } from "@/components/Nav";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const fontSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fontSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Virm — Your virtual mirror for personal styling",
  description: "Your virtual mirror for personal styling: a digital closet, AI outfits from what you own, and virtual try-on.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#eef4f7]">
        <ToastProvider>
          <AuthProvider>
            <Nav />
            <DemoModeBanner />
            <div className="flex flex-1 flex-col">{children}</div>
            <MobileTabBar />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
