import { ThemeProvider } from '@/providers/ThemeProvider';
import { Web3Provider } from '@/providers/Web3Provider';
import './globals.css';

export const metadata = {
  title: 'Attention.fi - Internet Capital Market',
  description: 'Trade creator tokens and prediction markets powered by attention economy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-[#0a0b0f] text-gray-900 dark:text-white transition-colors">
        <ThemeProvider>
          <Web3Provider>{children}</Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}