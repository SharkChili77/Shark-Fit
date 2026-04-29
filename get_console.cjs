const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // 捕获前端页面上的所有控制台输出和错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[PAGE ERROR] ${msg.text()}`);
    } else {
      console.log(`[PAGE LOG] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`[PAGE UNCAUGHT] ${error.message}`);
  });

  await page.goto('http://localhost:5173/');
  
  // 等待页面加载
  await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {});
  
  // 尝试点击第一个动作项，假设它的类名或什么包含 btn-scale 或能找到它
  // 我们在 WorkoutFlow 中寻找包含 '点击' 逻辑的按钮
  try {
    const exerciseBtns = await page.$$('button');
    let clicked = false;
    for (let btn of exerciseBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('俯卧撑') || text.includes('哑铃') || text.includes('杠铃')) {
        await btn.click();
        clicked = true;
        console.log('[NODE] Clicked exercise:', text);
        break;
      }
    }
    if (!clicked) {
      // 随机点击一个看似是动作的按钮
      console.log('[NODE] Could not find specific exercise text, trying to find by DOM structure...');
      const btn = await page.$('.glass-panel');
      if (btn) {
        await btn.click();
        console.log('[NODE] Clicked an exercise button!');
      }
    }
  } catch (err) {
    console.log('[NODE ERROR] clicking exercise:', err.message);
  }
  
  // 等待2秒以捕获可能的报错
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
