// src/services/api.js

// Replace this with your actual Kubernetes ingress or load balancer URL/IP when ready
const API_BASE_URL = 'https://api.bawaal.app/v1';

/**
 * Fetch live feed posts from the backend
 * @param {string} category - Optional sport category filter ('ALL', 'CRICKET', 'GYM', etc.)
 */
export async function fetchArenaFeed(category = 'ALL') {
  try {
    const url = category === 'ALL' 
      ? `${API_BASE_URL}/posts` 
      : `${API_BASE_URL}/posts?category=${category}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer YOUR_TOKEN_HERE' if auth is required
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Using fallback mock data due to network error:', error.message);
    
    // Fallback mock data matching your backend schema so the app never breaks offline
    return [
      {
        id: 'post_001',
        username: 'Yuki_Lift',
        handle: '@yuki_lift',
        location: 'Gold Gym Shibuya, Tokyo',
        category: 'GYM',
        avatarText: 'Y',
        videoUrl: null,
        targetBadge: '🏋️ 140 KG x 3 Reps',
        caption: 'Pushing heavy in Shibuya today! 🔥 #Powerlifting #Japan',
        fireCount: '4.1K',
        banterCount: '184',
        aiVerified: true,
        distance: '3.1 km away',
        timestamp: '45m ago',
      },
      {
        id: 'post_002',
        username: 'Rohit_VK7',
        handle: '@rohit_vk7',
        location: 'Virar Boxing Club',
        category: 'COMBAT',
        avatarText: 'R',
        videoUrl: null,
        targetBadge: '🥊 120 Strikes / Min',
        caption: 'Morning speed bag round. Who wants a piece? 🥊 #Boxing #Bawaal',
        fireCount: '2.8K',
        banterCount: '92',
        aiVerified: true,
        distance: '0.5 km away',
        timestamp: '10m ago',
      },
    ];
  }
}

/**
 * Send a 'Fire' reaction to a post
 */
export async function firePost(postId) {
  try {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/fire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await response.json();
  } catch (error) {
    console.error('Error firing post:', error);
    return { success: false };
  }
}