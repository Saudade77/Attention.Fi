'use client';

import '@rainbow-me/rainbowkit/styles.css';

import { 
  RainbowKitProvider, 
  getDefaultConfig, 
  darkTheme, 
  lightTheme,
  Theme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

// 使用更稳定的公共 RPC 节点（替换默认的 thirdweb）
const config = getDefaultConfig({
  appName: 'Attention.Fi',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [sepolia],
  transports: {
    // 使用多个备用 RPC，避免单点限流
    [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
  },
  ssr: true,
});

// 自定义 RainbowKit 主题
const customDarkTheme: Theme = {
  ...darkTheme({
    accentColor: '#3b82f6',
    accentColorForeground: 'white',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
  }),
  colors: {
    ...darkTheme().colors,
    modalBackground: '#12141c',
    modalBorder: '#1f2937',
    profileForeground: '#12141c',
    closeButton: '#9ca3af',
    closeButtonBackground: '#1f2937',
  },
  shadows: {
    ...darkTheme().shadows,
    dialog: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
};

const customLightTheme: Theme = {
  ...lightTheme({
    accentColor: '#3b82f6',
    accentColorForeground: 'white',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
  }),
  colors: {
    ...lightTheme().colors,
    modalBackground: '#ffffff',
    modalBorder: '#e5e7eb',
  },
};

function RainbowKitWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rainbowTheme = mounted && resolvedTheme === 'light' 
    ? customLightTheme 
    : customDarkTheme;

  return (
    <RainbowKitProvider 
      theme={rainbowTheme}
      modalSize="compact"
      showRecentTransactions={true}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        refetchOnWindowFocus: false,
      },
    },
  }));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitWrapper>
          {mounted ? children : (
            <div className="min-h-screen bg-gray-50 dark:bg-[#05060b]" />
          )}
        </RainbowKitWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  );
}