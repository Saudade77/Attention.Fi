import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// ============ 配置 ============
export const dynamic = 'force-dynamic';

const CREATORS_KEY = 'creators';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6小时

// ============ Redis 客户端（带容错） ============
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.warn('[Redis] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    return null;
  }
  
  return new Redis({ url, token });
}

// ============ Twitter API 获取数据 ============
async function fetchTwitterData(handle: string): Promise<any | null> {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) {
    console.warn('[Twitter] TWITTERAPI_IO_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(handle)}`,
      {
        headers: { 'X-API-Key': apiKey },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[Twitter] Rate limited for @${handle}`);
      }
      return null;
    }

    const json = await response.json();
    if (json.status !== 'success' || !json.data) {
      return null;
    }

    const user = json.data;
    const followers = user.followers || user.followersCount || 0;
    const tweets = user.tweets || user.statusesCount || 0;
    const engagement = user.favourites || user.favouritesCount || 0;

    return {
      handle: user.userName || user.screenName || handle,
      displayName: user.name || `@${handle}`,
      avatar: (user.profileImageUrl || '')?.replace('_normal', '_400x400') 
        || `https://unavatar.io/twitter/${handle}`,
      followers,
      following: user.following || user.friendsCount || 0,
      tweets,
      verified: user.verified || user.isBlueVerified || false,
      description: user.description || '',
      attentionScore: calculateAttentionScore(followers, tweets, engagement),
      updatedAt: Date.now(),
    };
  } catch (error) {
    console.error(`[Twitter] Error fetching @${handle}:`, error);
    return null;
  }
}

function calculateAttentionScore(followers: number, tweets: number, engagement: number): number {
  const followerScore = Math.min(Math.log10(followers + 1) * 100, 400);
  const activityScore = Math.min(Math.log10(tweets + 1) * 50, 200);
  const engagementScore = Math.min(Math.log10(engagement + 1) * 50, 200);
  return Math.round(followerScore + activityScore + engagementScore);
}

// ============ GET: 获取所有 或 单个 Creator ============
export async function GET(request: NextRequest) {
  const redis = getRedis();
  const handle = request.nextUrl.searchParams.get('handle')?.toLowerCase().replace(/^@/, '');
  const refresh = request.nextUrl.searchParams.get('refresh') === 'true';

  try {
    // ===== 获取单个 Creator =====
    if (handle) {
      // 验证 handle 格式
      if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
        return NextResponse.json({ error: 'Invalid handle format' }, { status: 400 });
      }

      // 从 Redis 获取缓存
      let cached: any = null;
      if (redis) {
        try {
          const cachedStr = await redis.hget(CREATORS_KEY, handle) as string | null;
          cached = cachedStr ? (typeof cachedStr === 'string' ? JSON.parse(cachedStr) : cachedStr) : null;
        } catch (e) {
          console.error('[Redis] Read error:', e);
        }
      }

      const cacheValid = cached?.updatedAt && (Date.now() - cached.updatedAt < CACHE_TTL_MS);
      
      // 如果不需要刷新且缓存有效，直接返回
      if (!refresh && cached && cacheValid) {
        console.log(`📦 Cache HIT for @${handle}`);
        return NextResponse.json(cached);
      }

      // 需要刷新或无缓存，从 Twitter 获取
      if (refresh || !cached) {
        console.log(`🔍 Fetching @${handle} from Twitter API...`);
        const freshData = await fetchTwitterData(handle);
        
        if (freshData && redis) {
          try {
            await redis.hset(CREATORS_KEY, { [handle]: JSON.stringify(freshData) });
            console.log(`✅ @${handle}: ${freshData.followers?.toLocaleString()} followers, Score: ${freshData.attentionScore}`);
          } catch (e) {
            console.error('[Redis] Write error:', e);
          }
          return NextResponse.json(freshData);
        }

        // Twitter API 失败，返回过期缓存
        if (cached) {
          console.log(`📦 Using stale cache for @${handle}`);
          return NextResponse.json({ ...cached, _stale: true });
        }

        // 完全没有数据，返回默认值
        return NextResponse.json({
          handle,
          displayName: `@${handle}`,
          avatar: `https://unavatar.io/twitter/${handle}`,
          followers: 0,
          following: 0,
          tweets: 0,
          verified: false,
          attentionScore: 0,
          updatedAt: Date.now(),
          _noData: true,
        });
      }

      return NextResponse.json(cached);
    }

    // ===== 获取所有 Creators =====
    if (!redis) {
      return NextResponse.json([]);
    }

    const creators = await redis.hgetall(CREATORS_KEY) || {};
    const result = Object.values(creators).map((item: any) => {
      if (typeof item === 'string') {
        try { return JSON.parse(item); } catch { return item; }
      }
      return item;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] GET error:', error);
    return NextResponse.json(handle ? { error: 'Failed to fetch' } : [], { status: handle ? 500 : 200 });
  }
}

// ============ POST: 注册新 Creator（自动获取 Twitter 数据） ============
export async function POST(request: NextRequest) {
  const redis = getRedis();

  try {
    const body = await request.json();
    const { handle: rawHandle, ...providedData } = body;

    if (!rawHandle) {
      return NextResponse.json({ error: 'Handle required' }, { status: 400 });
    }

    const handle = rawHandle.toLowerCase().replace(/^@/, '');

    // 先尝试从 Twitter 获取最新数据
    console.log(`🚀 Registering @${handle}, fetching Twitter data...`);
    const twitterData = await fetchTwitterData(handle);

    // 合并数据：Twitter 数据优先，提供的数据作为备份
    const metadata = {
      handle,
      displayName: twitterData?.displayName || providedData.displayName || `@${handle}`,
      avatar: twitterData?.avatar || providedData.avatar || `https://unavatar.io/twitter/${handle}`,
      followers: twitterData?.followers || providedData.followers || 0,
      following: twitterData?.following || providedData.following || 0,
      tweets: twitterData?.tweets || providedData.tweets || 0,
      verified: twitterData?.verified || providedData.verified || false,
      attentionScore: twitterData?.attentionScore || providedData.attentionScore || 0,
      launchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 保存到 Redis
    if (redis) {
      try {
        await redis.hset(CREATORS_KEY, { [handle]: JSON.stringify(metadata) });
        console.log(`✅ Saved @${handle} to Redis: ${metadata.followers?.toLocaleString()} followers, Score: ${metadata.attentionScore}`);
      } catch (e) {
        console.error('[Redis] Write error:', e);
      }
    }

    return NextResponse.json({ success: true, data: metadata });
  } catch (error) {
    console.error('[API] POST error:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

// ============ DELETE: 删除 Creator ============
export async function DELETE(request: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
  }

  try {
    const { handle: rawHandle } = await request.json();
    if (!rawHandle) {
      return NextResponse.json({ error: 'Handle required' }, { status: 400 });
    }

    const handle = rawHandle.toLowerCase().replace(/^@/, '');
    await redis.hdel(CREATORS_KEY, handle);
    console.log(`🗑️ Deleted @${handle} from Redis`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}