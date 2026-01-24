import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get('handle');
  
  if (!handle) {
    return NextResponse.json({ error: 'Handle required' }, { status: 400 });
  }

  try {
    // 根据截图，使用 User Endpoint
    const response = await fetch(
      `https://twitter241.p.rapidapi.com/user?username=${handle}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
          'X-RapidAPI-Host': 'twitter241.p.rapidapi.com',
        },
      }
    );

    // 添加详细的错误日志
    console.log('API Response Status:', response.status);
    
    const data = await response.json();
    console.log('API Response Data:', JSON.stringify(data, null, 2));

    // 检查 API 是否返回错误
    if (data.error || data.message || !data.id) {
      return NextResponse.json(
        { error: data.error || data.message || 'User not found' }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      handle: data.screen_name || data.username || handle,
      displayName: data.name || 'Unknown',
      avatar: data.profile_image_url_https || data.avatar || '',
      followers: data.followers_count ?? data.sub_count ?? 0,
      following: data.friends_count ?? data.following_count ?? 0,
      tweets: data.statuses_count ?? data.tweets_count ?? 0,
    });

  } catch (error) {
    console.error('Twitter API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}