const RELEASE = '';
const SHELL = ['./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-512-maskable.png'];
const cacheName='study-board-'+(RELEASE||'source-v4');
const scope=self.registration.scope,home=new URL('./',scope).href,index=new URL('./index.html',scope).href;
const owned=new Set(SHELL.map(p=>new URL(p,scope).href));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(SHELL.map(p=>new Request(new URL(p,scope),{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('study-board-')&&k!==cacheName).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET' || url.origin!==new URL(scope).origin) return;
  const navigation=req.mode==='navigate' && [home,index].includes(url.origin+url.pathname);
  if(!navigation && !owned.has(url.href)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName),key=navigation ? index : req;
    if(navigation && !RELEASE){
      try{
        const fresh=await fetch(req);
        if(fresh.ok)await cache.put(key,fresh.clone());
        return fresh;
      }catch(error){const copy=await cache.match(index);if(copy)return copy;throw error;}
    }
    return await cache.match(key) || fetch(req);
  })());
});

// ---------- Push notifications ----------
// Firebase Cloud Messaging can deliver a payload in two shapes depending on
// how it was sent: either flat ({title, body, ...}) or FCM's own wrapped
// "notification" shape ({notification: {title, body}, data: {...}}). This
// handler accepts either, so a message doesn't silently show up blank.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Study Board', body: event.data ? event.data.text() : '' }; }

  const notif = data.notification || {};
  const custom = data.data || {};

  const title = notif.title || data.title || 'Study Board';
  const body = notif.body || data.body || '';
  const url = custom.url || data.url || './index.html';

  const options = {
    body,
    icon: notif.icon || './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url },
    vibrate: [100, 50, 100]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('index.html') && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
