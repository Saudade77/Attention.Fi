'use client';

import { useState, useEffect } from 'react';

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    question: string,
    category: string,
    imageUrl: string,
    durationDays: number,
    initialLiquidity: string,
    creatorFeeBps: number,
    outcomeLabels?: string[]
  ) => Promise<void>;
}

const CATEGORIES = [
  { value: 'crypto', label: '₿ Crypto', color: 'from-orange-500 to-yellow-500' },
  { value: 'politics', label: '🏛️ Politics', color: 'from-blue-500 to-indigo-500' },
  { value: 'sports', label: '⚽ Sports', color: 'from-green-500 to-emerald-500' },
  { value: 'entertainment', label: '🎬 Entertainment', color: 'from-pink-500 to-rose-500' },
  { value: 'tech', label: '💻 Tech', color: 'from-purple-500 to-violet-500' },
];

// 格式化日期为 datetime-local 输入框所需格式
const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// 格式化日期用于显示
const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function CreateMarketModal({ isOpen, onClose, onCreate }: CreateMarketModalProps) {
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('crypto');
  const [imageUrl, setImageUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialLiquidity, setInitialLiquidity] = useState('100');
  const [creatorFee, setCreatorFee] = useState('1');
  const [marketType, setMarketType] = useState<'binary' | 'multi'>('binary');
  const [numOutcomes, setNumOutcomes] = useState(3);
  const [outcomeLabels, setOutcomeLabels] = useState<string[]>(['Option A', 'Option B', 'Option C']);
  const [loading, setLoading] = useState(false);

  // 初始化默认日期（开始：现在，结束：7天后）
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const defaultEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setStartDate(formatDateTimeLocal(now));
      setEndDate(formatDateTimeLocal(defaultEnd));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 计算持续天数
  const calculateDurationDays = (): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const diffMs = end - start;
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  };

  const durationDays = calculateDurationDays();

  // 验证日期
  const isDateValid = (): boolean => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    return end > start && end > now;
  };

  const handleNumOutcomesChange = (num: number) => {
    setNumOutcomes(num);
    const newLabels = Array.from({ length: num }, (_, i) => 
      outcomeLabels[i] || `Option ${String.fromCharCode(65 + i)}`
    );
    setOutcomeLabels(newLabels);
  };

  const handleLabelChange = (index: number, value: string) => {
    const updated = [...outcomeLabels];
    updated[index] = value;
    setOutcomeLabels(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !category) return;

    if (!isDateValid()) {
      alert('Please select valid start and end dates. End date must be after start date and in the future.');
      return;
    }

    // 验证多选项标签
    if (marketType === 'multi') {
      if (outcomeLabels.slice(0, numOutcomes).some(l => !l.trim())) {
        alert('All outcome labels must be filled');
        return;
      }
    }

    setLoading(true);
    try {
      const labels = marketType === 'binary' 
        ? ['Yes', 'No']
        : outcomeLabels.slice(0, numOutcomes);
      
      await onCreate(
        question,
        category,
        imageUrl,
        durationDays,
        initialLiquidity,
        parseInt(creatorFee) * 100,
        labels
      );
      onClose();
      // Reset form
      setQuestion('');
      setCategory('crypto');
      setImageUrl('');
      setInitialLiquidity('100');
      setCreatorFee('1');
      setMarketType('binary');
      setNumOutcomes(3);
      setOutcomeLabels(['Option A', 'Option B', 'Option C']);
    } catch (error: any) {
      alert(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取最小开始时间（现在）
  const getMinStartDate = (): string => {
    return formatDateTimeLocal(new Date());
  };

  // 获取最小结束时间（开始时间后1小时，或现在后1小时）
  const getMinEndDate = (): string => {
    const baseTime = startDate ? new Date(startDate) : new Date();
    const minEnd = new Date(baseTime.getTime() + 60 * 60 * 1000); // 至少1小时后
    return formatDateTimeLocal(minEnd);
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
          {/* Market Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Market Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMarketType('binary')}
                className={`p-3 rounded-xl transition-all ${
                  marketType === 'binary'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <div className="font-medium">Yes / No</div>
                <div className="text-xs opacity-75">Binary outcome</div>
              </button>
              <button
                type="button"
                onClick={() => setMarketType('multi')}
                className={`p-3 rounded-xl transition-all ${
                  marketType === 'multi'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <div className="font-medium">Multi-Choice</div>
                <div className="text-xs opacity-75">3-6 options</div>
              </button>
            </div>
          </div>

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
              placeholder={marketType === 'binary' 
                ? "Will Bitcoin reach $100k by end of 2025?"
                : "Who will win the 2024 F1 Championship?"
              }
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
              required
            />
          </div>

          {/* Multi-outcome Options */}
          {marketType === 'multi' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Outcomes
              </label>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumOutcomesChange(num)}
                    className={`py-2 rounded-xl font-medium transition-all ${
                      numOutcomes === num
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Outcome Labels
              </label>
              <div className="space-y-2">
                {Array.from({ length: numOutcomes }).map((_, index) => (
                  <input
                    key={index}
                    type="text"
                    value={outcomeLabels[index] || ''}
                    onChange={(e) => handleLabelChange(index, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ))}
              </div>
            </div>
          )}

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

          {/* Date Selection - 新的日期选择器 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Market Duration
            </label>
            <div className="space-y-3">
              {/* Start Date */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={getMinStartDate()}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                  required
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={getMinEndDate()}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                  required
                />
              </div>

              {/* Duration Info */}
              {startDate && endDate && (
                <div className={`p-3 rounded-xl text-sm ${
                  isDateValid()
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                }`}>
                  {isDateValid() ? (
                    <div className="flex items-center gap-2">
                      <span>⏱️</span>
                      <span>Duration: <strong>{durationDays} day{durationDays !== 1 ? 's' : ''}</strong></span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>⚠️</span>
                      <span>End date must be after start date and in the future</span>
                    </div>
                  )}
                </div>
              )}
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Minimum: $10 USDC
            </p>
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
            <div className="font-medium text-gray-900 dark:text-white mb-2">
              {question || 'Your question here...'}
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>📁 {category}</span>
              <span>⏱️ {durationDays} day{durationDays !== 1 ? 's' : ''}</span>
              <span>💰 ${initialLiquidity}</span>
              <span>💸 {creatorFee}% fee</span>
            </div>
            {/* 显示具体日期 */}
            {startDate && endDate && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div>📅 Start: {formatDisplayDate(startDate)}</div>
                <div>🏁 End: {formatDisplayDate(endDate)}</div>
              </div>
            )}
            {marketType === 'multi' && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Outcomes:</div>
                <div className="flex flex-wrap gap-1">
                  {outcomeLabels.slice(0, numOutcomes).map((label, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                      {label || `Option ${i + 1}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !question || !isDateValid()}
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
              `Create ${marketType === 'multi' ? 'Multi-Choice' : ''} Market ($${initialLiquidity} USDC)`
            )}
          </button>
        </form>
      </div>
    </div>
  );
}