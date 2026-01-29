import { NextRequest, NextResponse } from 'next/server';

// ============ 禁用 Next.js 缓存 ============
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get('handle')?.replace('@', '');

  if (!handle) {
    return NextResponse.json({ error: 'Handle required' }, { status: 400 });
  }

  try {
    // 改用 twitterapi.io（与其他 API 统一）
    const apiKey = process.env.TWITTERAPI_IO_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const response = await fetch(
      `https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(handle)}`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const json = await response.json();

    if (json.status !== 'success' || !json.data) {
      return NextResponse.json({ error: 'Invalid Twitter user' }, { status: 404 });
    }

    const data = json.data;

    // 统一字段映射（twitterapi.io 格式）
    const followers = data.followers || data.followersCount || data.followers_count || 0;
    const tweets = data.tweets || data.statusesCount || data.statuses_count || 0;
    const favourites = data.favourites || data.favouritesCount || data.favourites_count || 0;

    // 计算 Attention Score
    const attentionScore = calculateAttentionScore(followers, tweets, favourites);

    return NextResponse.json({
      valid: true,
      handle: data.userName || data.screenName || handle,
      displayName: data.name || 'Unknown',
      avatar: (data.profileImageUrl || data.profile_image_url_https || '')?.replace('_normal', '_400x400') 
        || `https://unavatar.io/twitter/${handle}`,
      followers,
      following: data.following || data.friendsCount || data.friends_count || 0,
      tweets,
      verified: data.verified || data.isBlueVerified || data.is_blue_verified || false,
      attentionScore,
      suggestedLiquidity: getSuggestedLiquidity(followers),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Twitter API error:', error);
    return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
  }
}

// 计算 Attention Score (0-1000)
function calculateAttentionScore(followers: number, tweets: number, engagement: number): number {
  // 加权算法
  const followerScore = Math.min(Math.log10(followers + 1) * 100, 400); // 最多400分
  const activityScore = Math.min(Math.log10(tweets + 1) * 50, 300);     // 最多300分
  const engagementScore = Math.min(Math.log10(engagement + 1) * 50, 300); // 最多300分

  return Math.floor(followerScore + activityScore + engagementScore);
}

// 基于粉丝数推荐初始流动性
function getSuggestedLiquidity(followers: number): number {
  if (followers > 1000000) return 1000;
  if (followers > 100000) return 500;
  if (followers > 10000) return 100;
  return 50;
}