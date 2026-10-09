import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { TBProvider, TBRouter, TBRecordEditWatcher } from '@/lib/teambridge';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'My Teambridge App',
  description: 'A Teambridge external app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TBProvider>
          {/* Keeps the parent Teambridge URL in sync with this iframe. */}
          <TBRouter />
          {/* Re-renders after a record is edited in the host's record detail panel. */}
          <TBRecordEditWatcher />
          {children}
        </TBProvider>
      </body>
    </html>
  );
}
