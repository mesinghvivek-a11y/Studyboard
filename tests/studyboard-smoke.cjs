const assert=require('node:assert/strict'), fs=require('node:fs'), http=require('node:http'), path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const root=path.resolve('dist');
  const server=http.createServer((req,res)=>{
    const route=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    const type={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
    res.setHeader('Content-Type',type[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
    const origin='http://127.0.0.1:'+server.address().port;
    const context=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[],firebase=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const url=route.request().url();
      if(url.startsWith(origin+'/'))return route.continue();
      if(/firebase|firestore|identitytoolkit|gstatic.com\/firebasejs/.test(url))firebase.push(url);
      return route.abort();
    });
    await page.addInitScript(()=>{
      window.studyboardOperations=[];
      window.studyboardDemoObserver=(op,doc)=>window.studyboardOperations.push([op,doc]);
    });
    await page.goto(origin+'/?perf=1');
    await page.locator('#boardReadyMetric').waitFor({timeout:20000});
    assert.match(await page.locator('#boardReadyMetric').innerText(),/Demo data.*Board ready/);
    assert.equal(await page.locator('#planSubtabContent .linked-item').count(),0);
    const tab=screen=>page.locator('.tab-btn[data-screen="'+screen+'"]').click();
    const calls=()=>page.evaluate(()=>window.studyboardOperations.slice());
    assert.equal((await calls()).filter(([,p])=>/^(comments|sharedTasks)\//.test(p)).length,0);
    await tab('today'); await page.locator('#taskList [data-progress-task]').first().waitFor();
    assert.equal(await page.locator('#taskList [data-progress-task]').count(),10);
    const timerTask = page.locator('#taskList [data-progress-task="t0"]');
    await timerTask.locator('.name').click();
    await tab('today');
    const runningLabel = timerTask.locator('.meta').filter({hasText: 'timer running'});
    await runningLabel.waitFor();
    const menuButton = timerTask.locator('[data-menu-id="t0"]');
    await menuButton.click();
    await timerTask.getByRole('button', {name: /Stop timer/}).waitFor();
    await menuButton.click();
    const countTasks=async()=>(await calls()).filter(([,p])=>/^(comments|sharedTasks)\//.test(p)).length;
    const start=await countTasks();
    await page.waitForTimeout(10300);
    await runningLabel.waitFor();
    assert.equal(await countTasks(),start,'Unchanged timer ticks issued task/comment reads');
    await tab('week');
    assert.equal(await page.locator('#planSubtabContent .linked-item').count(),0);
    await page.locator('#planSubtabContent [data-toggle]').first().click();
    assert.equal(await page.locator('#planSubtabContent .wgoal-card.open .linked-item').count(),90);
    const sharedCount=async()=>(await calls()).filter(([,p])=>p.startsWith('sharedTasks/')).length;
    const first=await sharedCount();
    await tab('history');await page.waitForTimeout(250);
    assert.equal(await sharedCount(),first);
    await page.locator('#toggleHistoryList').click();
    await page.locator('#historyList .history-day').first().waitFor();
    assert.equal(await page.locator('#historyList .history-day').count(),10);
    await tab('today');
    await page.locator('#taskList [data-progress-task="t1"] .check').click();
    await page.waitForFunction(()=>{
      const b=JSON.parse(localStorage.getItem('studyboard-preview-data-v1'))?.['boards/preview-student']?.value;
      return Object.entries(b?.completion||{}).some(([key,val])=>key.endsWith('|t1') && val==='done');
    });
    await page.reload();await page.locator('#boardReadyMetric').waitFor();
    await tab('today');await page.locator('#taskList [data-progress-task="t1"].done').waitFor();
    assert.deepEqual(firebase,[],'Sample-data preview contacted production Firebase');
    assert.deepEqual(errors,[],'Unexpected browser exceptions');
    console.log('Passed: startup, timer reads, 90-day plan expansion, lazy history, save/reload, preview isolation.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1;});
