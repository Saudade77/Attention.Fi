import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get('handle');
  
  if (!handle) {
    return NextResponse.json({ error: 'Handle required' }, { status: 400 });
  }

  const cleanHandle = handle.trim().replace('@', '');

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn('⚠️ RAPIDAPI_KEY not found');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    console.log(`🔍 Fetching Twitter data for: @${cleanHandle}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `https://twitter241.p.rapidapi.com/user?username=${encodeURIComponent(cleanHandle)}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'twitter241.p.rapidapi.com',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    console.log(`📡 API Response Status: ${response.status}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // 打印完整数据用于调试
    console.log('📦 Full API Response:', JSON.stringify(data, null, 2));

    // ========== 解析嵌套的数据结构 ==========
    // 数据路径: result.data.user.result
    const userResult = data?.result?.data?.user?.result;

    if (!userResult) {
      console.error('❌ No user result found in response');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 检查用户状态（suspended, protected 等）
    if (userResult.__typename === 'UserUnavailable') {
      const reason = userResult.reason || userResult.message || 'User unavailable';
      console.warn(`⚠️ User unavailable: ${reason}`);
      return NextResponse.json({ error: reason }, { status: 404 });
    }

    // 提取 legacy 数据（包含 followers_count 等）
    const legacy = userResult.legacy || {};
    const core = userResult.core || {};
    
    // 构建用户数据
    const userData = {
      handle: legacy.screen_name || cleanHandle,
      displayName: legacy.name || core.name || cleanHandle,
      avatar: (legacy.profile_image_url_https || userResult.avatar?.image_url || '')
        .replace('_normal', '_400x400'), // 获取高清头像
      followers: legacy.followers_count ?? 0,
      following: legacy.friends_count ?? 0,
      tweets: legacy.statuses_count ?? 0,
      verified: legacy.verified || userResult.is_blue_verified || false,
      // 额外信息（可选）
      description: legacy.description || '',
      createdAt: legacy.created_at || core.created_at || '',
    };

    console.log(`✅ Successfully parsed data for @${userData.handle}:`, {
      followers: userData.followers,
      following: userData.following,
      tweets: userData.tweets,
    });

    return NextResponse.json(userData);

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('⏱️ Request timeout');
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }
    
    console.error('❌ Fetch error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}