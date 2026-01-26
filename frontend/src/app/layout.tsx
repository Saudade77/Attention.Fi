import { Web3Provider } from '@/providers/Web3Provider';
import './globals.css';
// ❌ 不要在这里重复导入 rainbowkit/styles.css

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}