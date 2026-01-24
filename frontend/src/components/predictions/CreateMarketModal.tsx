'use client';

import { useState } from 'react';

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    question: string,
    category: string,
    imageUrl: string,
    durationDays: number,
    initialLiquidity: string,
    creatorFeeBps: number
  ) => Promise<void>;
}

const CATEGORIES = [
  { value: 'crypto', label: '₿ Crypto', color: 'from-orange-500 to-yellow-500' },
  { value: 'politics', label: '🏛️ Politics', color: 'from-blue-500 to-indigo-500' },
  { value: 'sports', label: '⚽ Sports', color: 'from-green-500 to-emerald-500' },
  { value: 'entertainment', label: '🎬 Entertainment', color: 'from-pink-500 to-rose-500' },
  { value: 'tech', label: '💻 Tech', color: 'from-purple-500 to-violet-500' },
];

export function CreateMarketModal({ isOpen, onClose, onCreate }: CreateMarketModalProps) {
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('crypto');
  const [imageUrl, setImageUrl] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [initialLiquidity, setInitialLiquidity] = useState('100');
  const [creatorFee, setCreatorFee] = useState('1');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !category) return;

    setLoading(true);
    try {
      await onCreate(
        question,
        category,
        imageUrl,
        parseInt(durationDays),
        initialLiquidity,
        parseInt(creatorFee) * 100
      );
      onClose();
      setQuestion('');
      setCategory('crypto');
      setImageUrl('');
      setDurationDays('7');
      setInitialLiquidity('100');
      setCreatorFee('1');
    } catch (error: any) {
      alert(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#12141c] rounded-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-[#12141c]">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">🔮 Create Prediction Market</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    category === cat.value
                      ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will Bitcoin reach $100k by end of 2025?"
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
              required
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Image URL (optional)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Duration
            </label>
            <div className="grid grid-cols-5 gap-2">
              {['1', '3', '7', '14', '30'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationDays(d)}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    durationDays === d
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Initial Liquidity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Initial Liquidity (USDC)
            </label>
            <div className="relative">
              <input
                type="number"
                min="10"
                value={initialLiquidity}
                onChange={(e) => setInitialLiquidity(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
                USDC
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum: $10 USDC</p>
          </div>

          {/* Creator Fee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Creator Fee (%)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['0', '1', '2', '3'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setCreatorFee(f)}
                  className={`py-2 rounded-xl text-sm font-medium transition-all ${
                    creatorFee === f
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {f}%
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">You earn this fee from every trade</p>
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Preview</div>
            <div className="font-medium text-gray-900 dark:text-white mb-1">
              {question || 'Your question here...'}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span>📁 {category}</span>
              <span>⏱️ {durationDays} days</span>
              <span>💰 ${initialLiquidity}</span>
              <span>💸 {creatorFee}% fee</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !question}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </span>
            ) : (
              `Create Market ($${initialLiquidity} USDC)`
            )}
          </button>
        </form>
      </div>
    </div>
  );
}