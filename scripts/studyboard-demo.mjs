const uid='preview-student', storageKey='studyboard-preview-data-v1';
const user={uid,displayName:'Demo student',isAnonymous:false,emailVerified:true};
const subscribers=new Map();
const clone=value=>value==null ? value : JSON.parse(JSON.stringify(value));
const removed=Symbol('delete field');
function day(offset){
  const d=new Date(); d.setDate(d.getDate()+offset);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function seed(){
  const profile={id:uid,name:'Demo student',color:'#007777'};
  const peer={id:'peer',name:'Study partner',color:'#997040'};
  const plan={id:'plan',label:'Revision plan',category:'study',startDate:day(0),endDate:day(89),createdAt:1,updatedAt:1};
  const names=['Physical geography','Indian polity','Sociology','Economics','Modern history','Map practice','Ethics','Current affairs','Environment','Revision notes'];
  const targets=Object.fromEntries(names.map((label,i)=>{
    const id='t'+i;
    return [id,{id,planId:'plan',kind:'recurring',timing:'floating',subject:'s1',days:[0,1,2,3,4,5,6],label,duration:30,createdAt:i+1,updatedAt:i+1}];
  }));
  return {['profiles/'+uid]:{value:profile},['boards/'+uid]:{value:{schemaVersion:5,subjects:{s1:{id:'s1',name:'Study',color:'#007777',updatedAt:1}},targets,plans:{plan},templates:{},tombstones:{},sessions:{},completion:{},goals:{dailyMin:120,weeklyMin:600}}},
    'registry/users':{value:[profile,peer]},['groupMemberships/'+uid]:{groupIds:['group'],activeGroupId:'group'},
    'groups/group':{id:'group',name:'Study circle',ownerId:uid,members:{[uid]:{},peer:{}}},
    'boards/peer':{value:{subjects:{},sessions:{},plans:{},targets:{}}},'liveStatus/peer':{studying:false,todayTotalMin:45}};
}
let data;
try{data=JSON.parse(localStorage.getItem(storageKey))||seed();}catch{data=seed();}
function snap(path){const value=clone(data[path]);return {exists:()=>value!==undefined,data:()=>value,val:()=>value,metadata:{fromCache:false,hasPendingWrites:false}};}
function merge(old,next){
  const result={...old};
  for(const [k,v] of Object.entries(next)){
    if(v===removed) delete result[k];
    else if(v && typeof v==='object' && !Array.isArray(v)) result[k]=merge(result[k],v);
    else result[k]=clone(v);
  }
  return result;
}
function publish(path){
  try{localStorage.setItem(storageKey,JSON.stringify(data));}catch{}
  for(const cb of subscribers.get(path)||[]){const value=snap(path); queueMicrotask(()=>{if(subscribers.get(path)?.has(cb)) cb(value);});}
}
function listen(path,options,success){
  globalThis.studyboardDemoObserver?.('listen',path);
  const cb=typeof options==='function'?options:success;
  if(!subscribers.has(path)) subscribers.set(path,new Set());
  const set=subscribers.get(path); set.add(cb);
  queueMicrotask(()=>{if(set.has(cb))cb(snap(path));});
  return ()=>set.delete(cb);
}
async function setDoc(path,value,opts){
  if(opts?.mergeFields){
    const target=clone(data[path]||{});
    for(const field of opts.mergeFields){
      const parts=field.split('.'), last=parts.pop(); let dst=target,src=value;
      for(const part of parts){dst=dst[part]||={};src=src[part];}
      dst[last]=clone(src[last]);
    }
    data[path]=target;
  }else data[path]=opts?.merge ? merge(data[path],value) : clone(value);
  publish(path);
}
const getDoc=async path=>{globalThis.studyboardDemoObserver?.('read',path);return snap(path);}, getDocFromServer=getDoc, get=getDoc;
const doc=(_db,...parts)=>parts.join('/'), ref=doc;
const deleteDoc=async path=>{delete data[path];publish(path);},deleteField=()=>removed;
const update=(p,v)=>setDoc(p,v,{merge:true}),onValue=listen,onSnapshot=listen;
const initializeApp=()=>({}), getDatabase=initializeApp,getFirestore=initializeApp;
const getAuth=()=>({currentUser:user});
const onAuthStateChanged=(_a,cb)=>{queueMicrotask(()=>cb(user));return ()=>{};};
const getRedirectResult=async()=>null,isSupported=async()=>false;
class GoogleAuthProvider {}
const unavailable=()=>{throw Error('Account operations are available on the live site. This preview uses local sample data.');};
export {initializeApp,getDatabase,getFirestore,getAuth,onAuthStateChanged,getRedirectResult,GoogleAuthProvider,doc,ref,get,getDoc,getDocFromServer,setDoc,deleteDoc,deleteField,update,onValue,onSnapshot,isSupported,
unavailable as getMessaging,unavailable as getToken,unavailable as onMessage,unavailable as createUserWithEmailAndPassword,unavailable as signInWithEmailAndPassword,unavailable as signInWithPopup,unavailable as signInWithRedirect,unavailable as signInAnonymously,unavailable as signOut,unavailable as updateProfile,unavailable as sendEmailVerification,unavailable as sendPasswordResetEmail,unavailable as deleteUser};
