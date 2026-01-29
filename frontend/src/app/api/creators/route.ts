import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// ============ Upstash Redis 客户端 ============
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CREATORS_KEY = 'creators';

// ============ GET: 获取所有 Creator 元数据 ============
export async function GET() {
  try {
    const creators = await redis.hgetall(CREATORS_KEY) || {};
    return NextResponse.json(Object.values(creators));
  } catch (error) {
    console.error('Failed to fetch creators:', error);
    return NextResponse.json([]);
  }
}

// ============ POST: 保存 Creator 元数据 ============
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { handle, displayName, avatar, followers, following, tweets, verified } = data;

    if (!handle) {
      return NextResponse.json({ error: 'Handle required' }, { status: 400 });
    }

    const key = handle.toLowerCase();
    const metadata = {
      handle,
      displayName: displayName || `@${handle}`,
      avatar: avatar || `https://unavatar.io/twitter/${handle}`,
      followers: followers || 0,
      following: following || 0,
      tweets: tweets || 0,
      verified: verified || false,
      updatedAt: Date.now(),
    };

    await redis.hset(CREATORS_KEY, { [key]: JSON.stringify(metadata) });

    return NextResponse.json({ success: true, data: metadata });
  } catch (error) {
    console.error('Failed to save creator:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

// ============ DELETE: 删除 Creator ============
export async function DELETE(request: NextRequest) {
  try {
    const { handle } = await request.json();
    if (!handle) {
      return NextResponse.json({ error: 'Handle required' }, { status: 400 });
    }

    const key = handle.toLowerCase();
    await redis.hdel(CREATORS_KEY, key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete creator:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}