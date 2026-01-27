'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePredictionMarket } from '@/hooks/usePredictionMarket';

export function Navbar() {
  const { usdcBalance, faucet, isOwner } = usePredictionMarket();

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🔮</span>
            <span className="font-bold text-xl text-gray-900 dark:text-white">
              Attention.Fi
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="/" 
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
            >
              Markets
            </Link>
            {isOwner && (
              <Link 
                href="/admin" 
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
              >
                Admin
              </Link>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* USDC Balance & Faucet */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                ${parseFloat(usdcBalance).toFixed(2)}
              </span>
              <button
                onClick={() => faucet('1000')}
                className="text-xs px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition"
                title="Get 1000 test USDC"
              >
                +1000
              </button>
            </div>

            {/* RainbowKit Connect Button */}
            <ConnectButton 
              showBalance={false}
              chainStatus="icon"
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}