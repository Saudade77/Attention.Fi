// components/ui/TradeToast.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface TradeToastProps {
  show: boolean;
  type: 'buy' | 'sell';
  creatorName: string;
  amount: string;
  price: string;
  onClose: () => void;
}

export function TradeToast({ show, type, creatorName, amount, price, onClose }: TradeToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className={`
            px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl
            ${type === 'buy' 
              ? 'bg-green-500/90 dark:bg-green-600/90' 
              : 'bg-red-500/90 dark:bg-red-600/90'
            }
          `}>
            <div className="flex items-center gap-4">
              {/* 成功图标动画 */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"
              >
                <motion.svg
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="w-6 h-6 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
              </motion.div>

              <div className="text-white">
                <div className="font-bold text-lg">
                  {type === 'buy' ? 'Bought' : 'Sold'} {creatorName}
                </div>
                <div className="text-white/80 text-sm">
                  {amount} keys @ ${price}
                </div>
              </div>

              {/* 粒子效果 */}
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 1 }}
                className="absolute inset-0 pointer-events-none"
              >
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: '50%', y: '50%', scale: 1 }}
                    animate={{
                      x: `${50 + (Math.random() - 0.5) * 100}%`,
                      y: `${50 + (Math.random() - 0.5) * 100}%`,
                      scale: 0,
                    }}
                    transition={{ duration: 0.8, delay: i * 0.05 }}
                    className={`absolute w-2 h-2 rounded-full ${
                      type === 'buy' ? 'bg-green-300' : 'bg-red-300'
                    }`}
                  />
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}