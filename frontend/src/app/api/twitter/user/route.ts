import { NextRequest, NextResponse } from 'next/server';

// ============ 类型定义 ============
type TwitterUserData = {
  handle: string;
  displayName: string;
  avatar: string;
  followers: number;
  following: number;
  tweets: number;
  verified: boolean;
  description?: string;
  createdAt?: string;
};

type CacheEntry = {
  data: TwitterUserData;
  freshUntil: number;
  staleUntil: number;
};

// ============ 内存缓存 ============
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<TwitterUserData>>();

const FRESH_TTL_MS = 6 * 60 * 60 * 1000;  // 6 小时
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时
const MAX_RETRIES = 2;

// ============ 工具函数 ============
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanHandle(input: string) {
  return input.trim().replace(/^@+/, '');
}

function isValidHandle(handle: string) {
  return /^[A-Za-z0-9_]{1,15}$/.test(handle);
}

function getCached(key: string) {
  const now = Date.now();
  const entry = cache.get(key);
  if (!entry) return null;
  if (now <= entry.freshUntil) return { kind: 'fresh' as const, entry };
  if (now <= entry.staleUntil) return { kind: 'stale' as const, entry };
  cache.delete(key);
  return null;
}

function setCached(key: string, data: TwitterUserData) {
  const now = Date.now();
  cache.set(key, {
    data,
    freshUntil: now + FRESH_TTL_MS,
    staleUntil: now + STALE_TTL_MS,
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(id);
  }
}

// ============ 核心：从 twitterapi.io 获取用户数据 ============
async function fetchTwitterUser(clean: string): Promise<TwitterUserData> {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('TWITTERAPI_IO_KEY not configured'), { status: 500 });
  }

  // twitterapi.io 的 API 地址
  const url = `https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(clean)}`;
  let lastErr: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const waitMs = 1000 * Math.pow(2, attempt);
        console.log(`⏳ Retry ${attempt}/${MAX_RETRIES} for @${clean}, waiting ${waitMs}ms...`);
        await sleep(waitMs);
      }

      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey,
          },
        },
        15000
      );

      console.log(`📡 twitterapi.io response for @${clean}: ${response.status} (attempt ${attempt + 1})`);

      // 处理速率限制
      if (response.status === 429) {
        lastErr = Object.assign(new Error('Rate limited by twitterapi.io'), { status: 429 });
        if (attempt < MAX_RETRIES) continue;
        throw lastErr;
      }

      if (!response.ok) {
        lastErr = Object.assign(new Error(`API error: ${response.status}`), { status: response.status });
        if (response.status >= 500 && attempt < MAX_RETRIES) continue;
        throw lastErr;
      }

      const json = await response.json();

      // twitterapi.io 的响应结构：{ status: "success", data: {...}, msg: "ok" }
      if (json.status !== 'success' || !json.data) {
        throw Object.assign(new Error(json.msg || 'User not found'), { status: 404 });
      }

      const user = json.data;

      // 根据 twitterapi.io 的响应字段映射
      const parsed: TwitterUserData = {
        handle: user.userName || user.screenName || clean,
        displayName: user.name || clean,
        avatar: (user.profileImageUrl || user.profile_image_url_https || '')
          .replace('_normal', '_400x400') || `https://unavatar.io/twitter/${clean}`,
        followers: user.followers || user.followersCount || user.followers_count || 0,
        following: user.following || user.friendsCount || user.friends_count || 0,
        tweets: user.tweets || user.statusesCount || user.statuses_count || 0,
        verified: user.verified || user.isBlueVerified || user.is_blue_verified || false,
        description: user.description || '',
        createdAt: user.createdAt || user.created_at || '',
      };

      console.log(`✅ @${clean}: ${parsed.followers.toLocaleString()} followers (via twitterapi.io)`);
      return parsed;

    } catch (e: any) {
      if (e?.name === 'AbortError') {
        lastErr = Object.assign(new Error('Request timeout'), { status: 504 });
        if (attempt < MAX_RETRIES) continue;
      }
      lastErr = e;
      if (e?.status >= 500 && attempt < MAX_RETRIES) continue;
      throw e;
    }
  }

  throw lastErr || Object.assign(new Error('Failed to fetch user'), { status: 500 });
}

// ============ GET 处理器 ============
export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get('handle');
  if (!handle) {
    return NextResponse.json({ error: 'Handle required' }, { status: 400 });
  }

  const clean = cleanHandle(handle);
  if (!isValidHandle(clean)) {
    return NextResponse.json({ error: 'Invalid handle format' }, { status: 400 });
  }

  const key = clean.toLowerCase();

  // 1) 新鲜缓存直接返回
  const cached = getCached(key);
  if (cached?.kind === 'fresh') {
    console.log(`📦 Cache HIT (fresh) for @${clean}`);
    return NextResponse.json(cached.entry.data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  }

  // 2) 并发请求合并
  if (inflight.has(key)) {
    try {
      const data = await inflight.get(key)!;
      return NextResponse.json(data);
    } catch (e: any) {
      if (cached?.kind === 'stale') {
        console.log(`📦 Using stale cache for @${clean} due to error`);
        return NextResponse.json({ ...cached.entry.data, _stale: true });
      }
      return NextResponse.json({ error: e?.message || 'Failed' }, { status: e?.status || 500 });
    }
  }

  // 3) 发起请求
  const p = (async () => {
    const data = await fetchTwitterUser(clean);
    setCached(key, data);
    return data;
  })();

  inflight.set(key, p);

  try {
    const data = await p;
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (e: any) {
    const status = e?.status || 500;

    if (cached?.kind === 'stale') {
      console.log(`📦 Using stale cache for @${clean} (error: ${status})`);
      return NextResponse.json({ ...cached.entry.data, _stale: true });
    }

    return NextResponse.json(
      { 
        error: e?.message || `API error: ${status}`,
        code: status === 429 ? 'RATE_LIMITED' : 'API_ERROR',
      }, 
      { status }
    );
  } finally {
    inflight.delete(key);
  }
}