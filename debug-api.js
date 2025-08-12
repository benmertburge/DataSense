#!/usr/bin/env node

// Debug ResRobot API access issue

async function debugAPI() {
  console.log('🔍 DEBUGGING RESROBOT API ACCESS\n');
  
  // Check if key exists in environment
  const apiKey = process.env.RESROBOT_API_KEY;
  console.log('API Key exists:', !!apiKey);
  console.log('API Key length:', apiKey ? apiKey.length : 0);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
  
  // Test basic ResRobot endpoint
  const testUrl = 'https://api.resrobot.se/v2.1/location.name?input=Stockholm&format=json&accessId=' + apiKey;
  
  try {
    console.log('\n🚀 Testing ResRobot location API...');
    const response = await fetch(testUrl);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API WORKING! Found', data.stopLocationOrCoordLocation?.length || 0, 'locations');
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
    }
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
}

debugAPI();