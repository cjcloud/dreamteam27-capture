import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from './client-layout';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'DreamTeam Capture 27',
  description: 'Dream Team Management 2027',
  icons: {
    icon: [
      {
        url: '/footballcapture26.png',
        sizes: 'any',
      },
      {
        url: '/footballcapture26.png',
        type: 'image/png',
        sizes: '32x32',
      },
      {
        url: '/footballcapture26.png',
        type: 'image/png',
        sizes: '180x180',
      },
    ],
    shortcut: '/footballcapture26.png',
    apple: [
      {
        url: '/footballcapture26.png',
        sizes: '180x180',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="aquamarine" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-dt-bg text-dt-content antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
