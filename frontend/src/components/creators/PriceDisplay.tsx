'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PriceDisplayProps {
  price: number;
  previousPrice?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function PriceDisplay({ price, previousPrice, size = 'md' }: PriceDisplayProps) {
  const [priceChange, setPriceChange] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef(price);

  useEffect(() => {
    if (price > prevPriceRef.current) {
      setPriceChange('up');
    } else if (price < prevPriceRef.current) {
      setPriceChange('down');
    }
    prevPriceRef.current = price;

    const timer = setTimeout(() => setPriceChange(null), 1000);
    return () => clearTimeout(timer);
  }, [price]);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className="relative">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={price}
          initial={{ y: priceChange === 'up' ? 10 : -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: priceChange === 'up' ? -10 : 10, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`font-bold ${sizeClasses[size]} ${
            priceChange === 'up'
              ? 'text-green-500'
              : priceChange === 'down'
              ? 'text-red-500'
              : 'text-gray-900 dark:text-white'
          }`}
        >
          ${price.toFixed(4)}
        </motion.span>
      </AnimatePresence>
      
      {/* 价格变动指示器 */}
      <AnimatePresence>
        {priceChange && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className={`absolute -right-6 top-1/2 -translate-y-1/2 ${
              priceChange === 'up' ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {priceChange === 'up' ? '↑' : '↓'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}