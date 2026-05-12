const fetch = require('node-fetch');
const crypto = require('crypto');

const BOOHEE_CONFIG = {
  appId: 'ehyqxslr64',
  appKey: 'yfs3fjw6n3shbg87oa2tmuu6zbqatirf',
  baseUrl: 'https://fc.boohee.com'
};

let cachedToken = null;
let tokenExpiry = 0;

/**
 * 获取或刷新薄荷 API AccessToken
 */
async function getAccessToken() {
  // 如果 Token 还没过期（留5分钟缓冲），直接使用缓存
  if (cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    // 签名算法: md5(app_key + "app_id" + app_id + "timestamp" + timestamp + app_key)
    const signStr = `${BOOHEE_CONFIG.appKey}app_id${BOOHEE_CONFIG.appId}timestamp${timestamp}${BOOHEE_CONFIG.appKey}`;
    const sign = crypto.createHash('md5').update(signStr).digest('hex');

    const res = await fetch(`${BOOHEE_CONFIG.baseUrl}/api/v2/access_tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_id: BOOHEE_CONFIG.appId,
        timestamp: timestamp.toString(),
        sign: sign
      })
    });

    const data = await res.json();
    if (data.access_token) {
      cachedToken = data.access_token;
      // 解析 expired_at (例如 "2026-06-12T19:22:06.238+08:00")
      tokenExpiry = new Date(data.expired_at).getTime(); 
      return cachedToken;
    }
    throw new Error(data.errors || '获取 Token 失败');
  } catch (err) {
    console.error('[薄荷鉴权失败]', err.message);
    return null;
  }
}

/**
 * 使用官方 API 搜索食物营养数据
 */
async function searchExternalFood(query) {
  try {
    const token = await getAccessToken();
    if (!token) return null;

    // 1. 关键词搜索食物
    const searchRes = await fetch(`${BOOHEE_CONFIG.baseUrl}/api/v1/foods/search?q=${encodeURIComponent(query)}`, {
      headers: { 'AccessToken': token }
    });
    const searchData = await searchRes.json();
    
    if (!searchData.foods || searchData.foods.length === 0) return null;
    const firstFood = searchData.foods[0];

    // 2. 获取食物详情 (v3) 获取精确宏量元素
    const detailRes = await fetch(`${BOOHEE_CONFIG.baseUrl}/api/v3/foods/${firstFood.code}`, {
      headers: { 'AccessToken': token }
    });
    const detailData = await detailRes.json();

    if (!detailData) return null;

    const nutrition = {
      name: detailData.food?.name || firstFood.name,
      calories_per_100g: 0,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 0,
      base_weight: 100
    };

    // 解析热量
    if (detailData.calory) {
      const totalCal = detailData.calory.find(c => c.name_en === 'total_calory');
      if (totalCal) nutrition.calories_per_100g = parseFloat(totalCal.value);
    }

    // 解析三大项
    if (detailData.base_ingredients) {
      detailData.base_ingredients.forEach(item => {
        if (item.name_en === 'protein') nutrition.protein_per_100g = item.value;
        if (item.name_en === 'carbohydrate') nutrition.carbs_per_100g = item.value;
        if (item.name_en === 'fat') nutrition.fat_per_100g = item.value;
      });
    }

    return nutrition;
  } catch (err) {
    console.error('[薄荷 API 调用失败]', err.message);
    return null;
  }
}

module.exports = { searchExternalFood };
