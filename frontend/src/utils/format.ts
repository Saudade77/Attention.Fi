// utils/format.ts
export const formatSocialMetric = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '-';
  
  const trim = (num: number) =>
    Number.isInteger(num) ? num.toString() : num.toFixed(1);

  if (value >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
  if (value >= 1_000_000)     return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000)         return `${trim(value / 1_000)}K`;
  return trim(value);
};