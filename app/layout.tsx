import type { Metadata } from 'next';
import { ThemeProvider } from '../components/context/ThemeContext';
import { SidebarProvider } from '../components/context/SidebarContext';
import { DashboardShell } from '../components/dashboard-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'HSMS',
  description: 'Hospital management system shell',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <SidebarProvider>
            <DashboardShell>{children}</DashboardShell>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
