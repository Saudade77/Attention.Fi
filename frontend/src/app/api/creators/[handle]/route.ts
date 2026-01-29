import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// ============ 禁用 Next.js 缓存 ============
export const dynamic = 'force-dynamic';

// ============ Upstash Redis 客户端 ============
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CREATORS_KEY = 'creators';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 小时

// ============ 从 twitterapi.io 获取数据 ============
async function fetchFromTwitterApi(handle: string) {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) {
    throw new Error('TWITTERAPI_IO_KEY not configured');
  }

  const url = `https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(handle)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Twitter API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.status !== 'success' || !json.data) {
    throw new Error(json.msg || 'User not found');
  }

  const user = json.data;

  const followers = user.followers || user.followersCount || user.followers_count || 0;
  const tweets = user.tweets || user.statusesCount || user.statuses_count || 0;
  const engagement = user.favourites || user.favouritesCount || user.favourites_count || 0;
  const attentionScore = calculateAttentionScore(followers, tweets, engagement);

  return {
    handle: user.userName || user.screenName || handle,
    displayName: user.name || handle,
    avatar: (user.profileImageUrl || user.profile_image_url_https || '')
      .replace('_normal', '_400x400') || `https://unavatar.io/twitter/${handle}`,
    followers,
    following: user.following || user.friendsCount || user.friends_count || 0,
    tweets,
    verified: user.verified || user.isBlueVerified || false,
    description: user.description || '',
    createdAt: user.createdAt || user.created_at || '',
    updatedAt: Date.now(),
    attentionScore,
  };
}

function calculateAttentionScore(followers: number, tweets: number, engagement: number): number {
  const followerScore = Math.min(Math.log10(followers + 1) * 100, 400);
  const engagementScore = Math.min(Math.log10(tweets + 1) * 50, 200);
  const marketScore = Math.min(Math.log10(engagement + 1) * 50, 200);
  return Math.round(followerScore + engagementScore + marketScore);
}

function isCacheValid(creator: any): boolean {
  if (!creator?.updatedAt) return false;
  return Date.now() - creator.updatedAt < CACHE_TTL_MS;
}

// ============ GET: 获取单个 Creator ============
// 🔧 修复: Next.js 15 中 params 是 Promise
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ handle: string }> }
) {
  // 🔧 关键修复: await params
  const { handle: rawHandle } = await context.params;
  const handle = rawHandle.toLowerCase().replace(/^@+/, '');
  
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ error: 'Invalid handle format' }, { status: 400 });
  }

  try {
    // 从 Redis 获取缓存
    const cachedStr = await redis.hget(CREATORS_KEY, handle) as string | null;
    const cached = cachedStr ? (typeof cachedStr === 'string' ? JSON.parse(cachedStr) : cachedStr) : null;

    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    const needsFetch = forceRefresh || !cached || !isCacheValid(cached);

    if (!needsFetch && cached) {
      console.log(`📦 Redis cache HIT for @${handle}`);
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // 从 Twitter API 获取
    console.log(`🔍 Fetching @${handle} from twitterapi.io...`);
    const freshData = await fetchFromTwitterApi(handle);
    
    // 保存到 Redis
    await redis.hset(CREATORS_KEY, { [handle]: JSON.stringify(freshData) });
    
    console.log(`✅ @${handle}: ${freshData.followers.toLocaleString()} followers, Score: ${freshData.attentionScore}`);
    
    return NextResponse.json(freshData, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error: any) {
    console.error(`❌ Failed to fetch @${handle}:`, error.message);
    
    // 尝试返回过期缓存
    try {
      const cachedStr = await redis.hget(CREATORS_KEY, handle) as string | null;
      if (cachedStr) {
        const cached = typeof cachedStr === 'string' ? JSON.parse(cachedStr) : cachedStr;
        console.log(`📦 Using stale cache for @${handle}`);
        return NextResponse.json({ ...cached, _stale: true });
      }
    } catch {}
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: 404 }
    );
  }
}

// ============ PUT: 更新 Creator 数据 ============
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: rawHandle } = await context.params;
    const handle = rawHandle.toLowerCase().replace(/^@+/, '');
    const body = await request.json();
    
    const cachedStr = await redis.hget(CREATORS_KEY, handle) as string | null;
    const existing = cachedStr ? (typeof cachedStr === 'string' ? JSON.parse(cachedStr) : cachedStr) : {};
    
    const updated = {
      ...existing,
      ...body,
      handle,
      updatedAt: Date.now(),
    };
    
    await redis.hset(CREATORS_KEY, { [handle]: JSON.stringify(updated) });
    
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============ DELETE: 删除 Creator ============
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: rawHandle } = await context.params;
    const handle = rawHandle.toLowerCase();
    await redis.hdel(CREATORS_KEY, handle);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}