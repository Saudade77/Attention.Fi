import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get('handle')?.replace('@', '');

  if (!handle) {
    return NextResponse.json({ error: 'Handle required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://twitter241.p.rapidapi.com/user?username=${handle}`,
      {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
          'X-RapidAPI-Host': 'twitter241.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = await response.json();

    if (!data || data.error) {
      return NextResponse.json({ error: 'Invalid Twitter user' }, { status: 404 });
    }

    // 计算初始 Attention Score
    const attentionScore = calculateAttentionScore(data);

    return NextResponse.json({
      valid: true,
      handle: data.screen_name || data.username || handle,
      displayName: data.name || 'Unknown',
      avatar: (data.profile_image_url_https || data.avatar || '')?.replace('_normal', '_400x400'),
      followers: data.followers_count ?? data.sub_count ?? 0,
      following: data.friends_count ?? data.following_count ?? 0,
      tweets: data.statuses_count ?? data.tweets_count ?? 0,
      verified: data.verified || data.is_blue_verified || false,
      attentionScore,
      suggestedLiquidity: getSuggestedLiquidity(data.followers_count || 0),
    });
  } catch (error) {
    console.error('Twitter API error:', error);
    return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
  }
}

// 计算 Attention Score (0-1000)
function calculateAttentionScore(data: any): number {
  const followers = data.followers_count || 0;
  const tweets = data.statuses_count || 0;
  const engagement = data.favourites_count || 0;

  // 加权算法
  const followerScore = Math.min(followers / 1000, 400); // 最多400分
  const activityScore = Math.min(tweets / 100, 300); // 最多300分
  const engagementScore = Math.min(engagement / 1000, 300); // 最多300分

  return Math.floor(followerScore + activityScore + engagementScore);
}

// 基于粉丝数推荐初始流动性
function getSuggestedLiquidity(followers: number): number {
  if (followers > 1000000) return 1000; // 100万粉以上
  if (followers > 100000) return 500;   // 10万粉以上
  if (followers > 10000) return 100;    // 1万粉以上
  return 50; // 默认
}