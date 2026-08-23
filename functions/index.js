const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const logger = require('firebase-functions/logger');

initializeApp();
const db = getFirestore();
const messaging = getMessaging();
const TZ = 'Asia/Kolkata';

const DEFAULTS = {
  timerEnd: true,
  taskApproaching: true,
  studyStart: true,
  taskActivity: true,
  groupActivity: true,
};

async function getPrefs(uid) {
  try {
    const snap = await db.doc(`notificationSettings/${uid}`).get();
    return { ...DEFAULTS, ...(snap.exists ? (snap.data() || {}) : {}) };
  } catch (e) { return { ...DEFAULTS }; }
}

async function sendToUser(uid, title, body, type='taskActivity', url='./index.html') {
  if (!uid) return;
  const prefs = await getPrefs(uid);
  if (prefs[type] === false) return;
  const snap = await db.doc(`pushTokens/${uid}`).get();
  if (!snap.exists) return;
  const token = snap.data().token;
  if (!token) return;
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: { url, type, ts: String(Date.now()) },
      webpush: { fcmOptions: { link: url } }
    });
  } catch (e) {
    const code = e && e.errorInfo && e.errorInfo.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      await db.doc(`pushTokens/${uid}`).delete().catch(()=>{});
    } else {
      logger.warn('FCM send failed', { uid, code, message: e.message });
    }
  }
}

function inferType(item) {
  if (item && item.type) return item.type;
  const text = String((item && item.text) || '').toLowerCase();
  if (text.includes('joined') || text.includes('left')) return 'groupActivity';
  if (text.includes('commented') || text.includes('added a task') || text.includes('weekly block')) return 'taskActivity';
  if (text.includes('started studying')) return 'studyStart';
  if (text.includes('timer')) return 'timerEnd';
  return 'taskActivity';
}

// Existing app already writes in-app notifications to notifications/{uid}.
// This trigger turns newly-added items into real FCM system notifications.
exports.deliverNotification = onDocumentWritten('notifications/{uid}', async (event) => {
  const before = event.data && event.data.before.exists ? (event.data.before.data().items || []) : [];
  const after = event.data && event.data.after.exists ? (event.data.after.data().items || []) : [];
  if (after.length <= before.length) return;
  const newItems = after.slice(before.length);
  for (const item of newItems) {
    await sendToUser(event.params.uid, 'Study Board', item.text || 'New activity', inferType(item));
  }
});

function localParts(date=new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit', weekday:'short', hour:'2-digit', minute:'2-digit', hour12:false
  }).formatToParts(date);
  const o={}; for(const x of p) o[x.type]=x.value;
  const weekdayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return { date:`${o.year}-${o.month}-${o.day}`, weekday:weekdayMap[o.weekday], hour:Number(o.hour), minute:Number(o.minute) };
}

function minutesOfDay(h,m){ return h*60+m; }

async function sendOnce(uid, key, payload) {
  const ref=db.doc(`notificationScheduler/${uid}`);
  const snap=await ref.get(); const data=snap.exists?(snap.data()||{}):{};
  const sent=data.sent||{};
  if(sent[key]) return false;
  await sendToUser(uid,payload.title,payload.body,payload.type);
  sent[key]=Date.now();
  const keys=Object.keys(sent);
  if(keys.length>100) keys.sort((a,b)=>(sent[a]||0)-(sent[b]||0)).slice(0,keys.length-100).forEach(k=>delete sent[k]);
  await ref.set({sent},{merge:true});
  return true;
}

exports.scheduleStudyReminders = onSchedule({schedule:'every 1 minutes', timeZone:TZ}, async () => {
  const now=localParts();
  const users=await db.collection('boards').get();
  for(const docSnap of users.docs){
    const uid=docSnap.id; const data=docSnap.data()||{};
    const prefs=await getPrefs(uid);
    if(prefs.taskApproaching===false) continue;
    const tasks=[];
    const extra=(data.dailyExtra && data.dailyExtra[now.date])||[];
    for(const b of extra) tasks.push(b);
    const templ=data.weeklyTemplate||[];
    for(const b of templ) if(Number(b.day)===now.weekday) tasks.push(b);
    const nowMin=minutesOfDay(now.hour,now.minute);
    for(const t of tasks){
      if(!t.start) continue;
      const [h,m]=String(t.start).split(':').map(Number); if(!Number.isFinite(h)||!Number.isFinite(m)) continue;
      if(Math.abs(minutesOfDay(h,m)-nowMin)!==5) continue;
      const key=`task5:${now.date}:${t.id}`;
      await sendOnce(uid,key,{title:'Task approaching',body:`${t.label || t.name || 'Your task'} starts in 5 minutes.`,type:'taskApproaching'});
    }
  }
});

exports.scheduleTimerEndReminders = onSchedule({schedule:'every 1 minutes', timeZone:TZ}, async () => {
  const now=Date.now();
  const snaps=await db.collection('liveStatus').where('studying','==',true).get();
  for(const s of snaps.docs){
    const st=s.data()||{}; if(st.mode!=='countdown'||!st.startedAt||!st.totalMs) continue;
    const end=Number(st.startedAt)+Number(st.totalMs)-(Number(st.baseElapsedMs)||0);
    if(end<=now && end>now-120000){
      const key=`timerEnd:${Math.floor(end/60000)}`;
      await sendOnce(s.id,key,{title:'Focus timer finished',body:'Your focus timer has ended. Nice work.',type:'timerEnd'});
      await s.ref.set({timerEndNotifiedAt:end},{merge:true});
    }
  }
});
