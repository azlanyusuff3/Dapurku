const DB_NAME='DapurKuDB';
const DB_VERSION=1;
const STORE_NAMES=['items','shopping','history','recipes','settings'];
let db;
let currentView='home';
let deferredPrompt=null;
let shoppingMode=false;
let shoppingSnapshot=null;
let cloudClient=null;
let cloudUser=null;
let cloudHouseholds=[];
let cloudMembers=[];
let activeHousehold=null;
let cloudChannel=null;
let cloudConfigured=false;
let suppressCloudSync=false;
let cloudBusy=false;
let cloudStatus='Local only';
let renderTimer=null;
let cloudLoginPromise=null;
let cloudResumeBusy=false;
let lastCloudPullAt=0;

const $=sel=>document.querySelector(sel);
const $$=sel=>[...document.querySelectorAll(sel)];
const uid=()=>crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const todayISO=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>d ? new Intl.DateTimeFormat('en-MY',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${d}T12:00:00`)) : '-';
const escapeHtml=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const daysBetween=(a,b)=>Math.round((new Date(b)-new Date(a))/86400000);
const daysUntil=d=>Math.ceil((new Date(`${d}T23:59:59`)-new Date())/86400000);

const RECIPE_INGREDIENT_BM={"anchovies":"ikan bilis","asam gelugur":"asam keping","baby corn":"jagung muda","banana":"pisang","barramundi":"ikan siakap","basmati rice":"beras basmati","bean sprouts":"taugeh","beef":"daging lembu","beef bones":"tulang lembu","belacan":"belacan","bell pepper":"capsicum","bird’s eye chilli":"cili padi","black pepper":"lada hitam","black pepper sauce":"sos lada hitam","bread":"roti","broccoli":"brokoli","butter":"mentega","canned sardine":"sardin tin","canned tuna":"tuna tin","cardamom":"buah pelaga","carrot":"lobak merah","cauliflower":"bunga kubis","celery leaf":"daun sup","cheddar cheese":"keju cheddar","cherry tomato":"tomato ceri","chicken":"ayam","chilli paste":"pes cili","chilli powder":"serbuk cili","chilli sauce":"sos cili","chives":"kucai","cinnamon":"kulit kayu manis","clove":"bunga cengkih","coconut milk":"santan","cooked rice":"nasi putih","cooking cream":"krim masakan","cooking oil":"minyak masak","coriander":"daun ketumbar","coriander powder":"serbuk ketumbar","crab":"ketam","cucumber":"timun","cumin powder":"serbuk jintan putih","curry leaf":"daun kari","curry powder":"serbuk kari","daun kesum":"daun kesum","dried chilli":"cili kering","dried chilli flakes":"emping cili kering","egg":"telur","eggplant":"terung","evaporated milk":"susu cair","fennel powder":"serbuk jintan manis","fiddlehead fern":"pucuk paku","fish":"ikan","fish cake":"kek ikan","fish sauce":"sos ikan","flat rice noodles":"kuey teow","flour":"tepung gandum","fresh turmeric":"kunyit hidup","fried shallot":"bawang goreng","galangal":"lengkuas","garlic":"bawang putih","ghee":"minyak sapi","ginger":"halia","glass noodles":"suhun","grated coconut":"kelapa parut","honey":"madu","instant noodles":"mi segera","kaffir lime leaf":"daun limau purut","kailan":"kailan","kerutuk spice":"rempah kerutuk","kurma powder":"rempah kurma","laksa noodles":"mi laksa","lemon":"lemon","lemongrass":"serai","lime":"limau nipis","long beans":"kacang panjang","macaroni":"makaroni","mackerel":"ikan kembung","milk":"susu","minced beef":"daging kisar","minced chicken":"ayam kisar","mixed herbs":"herba campuran","mixed vegetables":"sayur campur","mushroom":"cendawan","mustard greens":"sawi","okra":"bendi","olive oil":"minyak zaitun","onion":"bawang besar","oyster sauce":"sos tiram","palm sugar":"gula melaka","pandan leaf":"daun pandan","parmesan cheese":"keju parmesan","parsley":"daun parsli","pasta":"pasta","peanuts":"kacang tanah","peas":"kacang pea","petai":"petai","pineapple":"nanas","potato":"kentang","prawns":"udang","raisins":"kismis","red chilli":"cili merah","rice":"beras","rice vermicelli":"bihun","river prawns":"udang galah","salt":"garam","salted fish":"ikan masin","sesame oil":"minyak bijan","shallot":"bawang merah","soto spice":"rempah soto","soup spice":"rempah sup","soy sauce":"kicap masin","spaghetti":"spageti","spring onion":"daun bawang","squid":"sotong","star anise":"bunga lawang","sugar":"gula","sweet potato":"ubi keledek","sweet soy sauce":"kicap manis","tamarind":"asam jawa","tempeh":"tempe","thai basil":"daun selasih Thai","toasted coconut paste":"kerisik","tofu":"tauhu","tofu puff":"tauhu pok","tom yum paste":"pes tomyam","tomato":"tomato","tomato puree":"puri tomato","tomato sauce":"sos tomato","tomato soup":"sup tomato","torch ginger":"bunga kantan","turmeric leaf":"daun kunyit","turmeric powder":"serbuk kunyit","vinegar":"cuka","water":"air","water spinach":"kangkung","white pepper":"lada putih","yellow noodles":"mi kuning"};
const RECIPE_TITLE_BM={"Ikan Sweet & Sour":"Ikan Masam Manis","Tomyam Seafood":"Tomyam Makanan Laut","Tuna Egg Fried Rice":"Nasi Goreng Tuna Telur","Egg Fried Rice":"Nasi Goreng Telur","Creamy Chicken Pasta":"Pasta Ayam Berkrim","Chicken Chop Black Pepper":"Chicken Chop Sos Lada Hitam","Mac & Cheese":"Makaroni Keju","French Toast":"Roti Telur Manis"};
const basicName=name=>String(name??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const RECIPE_BM_TO_CANON=Object.fromEntries(Object.entries(RECIPE_INGREDIENT_BM).map(([en,bm])=>[basicName(bm),basicName(en)]));
const recipeIngredientLabel=name=>RECIPE_INGREDIENT_BM[name]||name;
const recipeTitleLabel=r=>RECIPE_TITLE_BM[r?.title]||r?.title||'';
const recipeNoteLabel=r=>String(r?.id||'').match(/^r\d+$/)?(r?.sourceName==='Che Nom'?'Senarai bahan untuk semakan stok DapurKu. Buka sumber rasmi Che Nom untuk sukatan tepat dan cara memasak penuh.':'Senarai bahan untuk padanan stok dapur. Laraskan sukatan mengikut jumlah hidangan yang diperlukan.'):(r?.note||'Resipi anda sendiri.');

function normalizeName(name=''){
  let n=basicName(name);
  if(RECIPE_BM_TO_CANON[n])n=RECIPE_BM_TO_CANON[n];
  const aliases=[
    [/\bayam\b/g,'chicken'],[/\bdaging\b/g,'beef'],[/\budang galah\b/g,'river prawns'],[/\budang\b/g,'prawns'],[/\bsotong\b/g,'squid'],[/\bketam\b/g,'crab'],
    [/\bikan siakap\b/g,'barramundi'],[/\bsiakap\b/g,'barramundi'],[/\bikan kembung\b/g,'mackerel'],[/\bikan bilis\b/g,'anchovies'],[/\bikan masin\b/g,'salted fish'],
    [/\bsantan(?: kotak| pekat| cair)?\b/g,'coconut milk'],[/\bcili (?:api|padi)\b/g,'birds eye chilli'],[/\bbirds eye chili\b/g,'birds eye chilli'],
    [/\bkunyit hidup\b/g,'fresh turmeric'],[/\bserbuk kunyit\b/g,'turmeric powder'],[/\bserai\b/g,'lemongrass'],[/\bdaun kunyit\b/g,'turmeric leaf'],
    [/\basam keping\b/g,'asam gelugur'],[/\bbawang besar\b/g,'onion'],[/\bbawang merah(?: kecil)?\b/g,'shallot'],[/\bbawang putih\b/g,'garlic'],[/\bhalia\b/g,'ginger'],
    [/\blengkuas\b/g,'galangal'],[/\bcili merah\b/g,'red chilli'],[/\bcili kering\b/g,'dried chilli'],[/\bkicap manis\b/g,'sweet soy sauce'],[/\bkicap masin\b/g,'soy sauce'],
    [/\bsos tiram\b/g,'oyster sauce'],[/\bsos cili\b/g,'chilli sauce'],[/\bsos tomato\b/g,'tomato sauce'],[/\bminyak masak\b/g,'cooking oil'],[/\bberas\b/g,'rice'],
    [/\btelur\b/g,'egg'],[/\bkentang\b/g,'potato'],[/\blobak merah\b/g,'carrot'],[/\bsawi\b/g,'mustard greens'],[/\btaugeh\b/g,'bean sprouts'],[/\btauhu\b/g,'tofu'],
    [/\bdaun limau purut\b/g,'kaffir lime leaf'],[/\blimau nipis\b/g,'lime'],[/\blimau kasturi\b/g,'lime'],[/\bgula melaka\b/g,'palm sugar'],[/\bgula\b/g,'sugar'],[/\bgaram\b/g,'salt'],
    [/\bsusu segar\b/g,'milk'],[/\bsusu\b/g,'milk'],[/\bdaun bawang\b/g,'spring onion'],[/\bdaun sup\b/g,'celery leaf'],[/\bbawang goreng\b/g,'fried shallot'],
    [/\bmee kuning\b/g,'yellow noodles'],[/\bbihun\b/g,'rice vermicelli'],[/\bnasi putih\b/g,'cooked rice'],[/\bnasi\b/g,'cooked rice'],[/\bpetai\b/g,'petai']
  ];
  aliases.forEach(([re,to])=>n=n.replace(re,to));
  return n.replace(/\s+/g,' ').trim();
}

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=e=>{const d=e.target.result;STORE_NAMES.forEach(name=>{if(!d.objectStoreNames.contains(name))d.createObjectStore(name,{keyPath:'id'});});};req.onsuccess=e=>{db=e.target.result;resolve(db)};req.onerror=e=>reject(e.target.error);});}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function getAll(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function getOne(store,id){return new Promise((res,rej)=>{const r=tx(store).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function putRaw(store,val){return new Promise((res,rej)=>{const r=tx(store,'readwrite').put(val);r.onsuccess=()=>res(val);r.onerror=()=>rej(r.error)})}
function delRaw(store,id){return new Promise((res,rej)=>{const r=tx(store,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearStore(store){return new Promise((res,rej)=>{const r=tx(store,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function syncableRecord(store,val=null){return ['items','shopping','history'].includes(store)||(store==='recipes'&&val&&!/^r\d+$/.test(String(val.id||'')))}
function readSyncQueue(){try{return JSON.parse(localStorage.getItem('dapurkuSyncQueue')||'[]')}catch{return []}}
function writeSyncQueue(q){localStorage.setItem('dapurkuSyncQueue',JSON.stringify(q))}
function queueCloudRecord(store,id,payload,isDeleted=false){
  if(suppressCloudSync||!cloudUser||!activeHousehold||!syncableRecord(store,payload||{id}))return;
  const key=`${activeHousehold.id}:${store}:${id}`,q=readSyncQueue().filter(x=>x.key!==key);q.push({key,householdId:activeHousehold.id,store,id,payload,isDeleted,queuedAt:new Date().toISOString()});writeSyncQueue(q);flushSyncQueue().catch(()=>{});
}
async function put(store,val){const out=await putRaw(store,val);queueCloudRecord(store,val.id,val,false);return out}
async function del(store,id){let oldVal=null;try{oldVal=await getOne(store,id)}catch{}await delRaw(store,id);queueCloudRecord(store,id,oldVal||{id},true)}


function getTheme(){return localStorage.getItem('dapurkuTheme')||'light'}
function applyTheme(theme){const t=theme==='dark'?'dark':'light';document.documentElement.dataset.theme=t;localStorage.setItem('dapurkuTheme',t);const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',t==='dark'?'#101722':'#2f6fda');const b=$('#themeBtn');if(b){b.textContent=t==='dark'?'☀':'☾';b.title=t==='dark'?'Switch to light mode':'Switch to dark mode'}}
function toggleTheme(){applyTheme(getTheme()==='dark'?'light':'dark');toast(`${getTheme()==='dark'?'Dark':'Light'} mode`)}
function cloudConfig(){const c=window.DAPURKU_CONFIG||{};return{url:String(c.supabaseUrl||'').trim(),key:String(c.supabaseKey||'').trim()}}
function hasCloudConfig(){const c=cloudConfig();return /^https:\/\/.+\.supabase\.co$/i.test(c.url)&&c.key.length>20&&!/YOUR_|PASTE_/i.test(c.key)}
function latestPurchaseFor(name,history=[]){const key=normalizeName(name);let latest='';for(const h of history){if((h.items||[]).some(i=>normalizeName(i.name)===key)&&(!latest||h.date>latest))latest=h.date}return latest}
function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>render().catch(()=>{}),120)}
function activeHouseholdName(){return activeHousehold?.name||'Shared Kitchen'}

async function initCloudSync(){
  applyTheme(getTheme());cloudConfigured=hasCloudConfig()&&!!window.supabase;
  if(!cloudConfigured){cloudStatus='Local only';return}
  const c=cloudConfig();
  const freshFetch=(input,init={})=>{const next={...init};const method=String(next.method||'GET').toUpperCase();if(method==='GET')next.cache='no-store';return fetch(input,next)};
  cloudClient=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:freshFetch},realtime:{worker:true}});
  cloudClient.auth.onAuthStateChange((event,session)=>{cloudUser=session?.user||null;setTimeout(async()=>{if(cloudUser&&['SIGNED_IN','INITIAL_SESSION','USER_UPDATED'].includes(event))await runAfterCloudLogin(false);else if(!cloudUser){activeHousehold=null;cloudHouseholds=[];unsubscribeCloud();cloudStatus='Signed out';scheduleRender()}},0)});
  const {data}=await cloudClient.auth.getSession();cloudUser=data?.session?.user||null;
  if(cloudUser)await runAfterCloudLogin(false);
}
async function runAfterCloudLogin(showToast=true){
  if(cloudLoginPromise)return cloudLoginPromise;
  cloudLoginPromise=afterCloudLogin(showToast).finally(()=>{cloudLoginPromise=null});
  return cloudLoginPromise;
}
async function afterCloudLogin(showToast=true){
  if(!cloudClient||!cloudUser)return;
  cloudStatus='Connecting…';scheduleRender();
  try{await cloudClient.rpc('dapurku_claim_invites');}catch{}
  await refreshHouseholds();
  if(!cloudHouseholds.length){
    const {data,error}=await cloudClient.rpc('dapurku_create_household',{p_name:'Our Kitchen'});if(error)throw error;
    await refreshHouseholds();if(data)localStorage.setItem('dapurkuActiveHousehold',String(data));
  }
  const saved=localStorage.getItem('dapurkuActiveHousehold');
  const shared=cloudHouseholds.find(h=>h.membership?.role==='member');
  let target=shared||cloudHouseholds.find(h=>h.id===saved)||cloudHouseholds.find(h=>h.owner_id===cloudUser.id)||cloudHouseholds[0];
  if(target)await activateHousehold(target.id,{showToast:false});
  if(showToast)toast('Kitchen sync connected');
}
async function refreshHouseholds(){
  if(!cloudClient||!cloudUser)return[];
  try{await cloudClient.rpc('dapurku_claim_invites')}catch{}
  const {data:members,error}=await cloudClient.from('dapurku_members').select('household_id,email,role,created_at').eq('user_id',cloudUser.id);if(error)throw error;
  const ids=[...new Set((members||[]).map(m=>m.household_id))];if(!ids.length){cloudHouseholds=[];return[]}
  const {data:houses,error:he}=await cloudClient.from('dapurku_households').select('id,name,owner_id,created_at').in('id',ids);if(he)throw he;
  cloudHouseholds=(houses||[]).map(h=>({...h,membership:(members||[]).find(m=>m.household_id===h.id)})).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));return cloudHouseholds;
}
async function activateHousehold(id,{showToast=true}={}){
  if(!cloudClient||!cloudUser)return;const h=cloudHouseholds.find(x=>x.id===id);if(!h)return;
  activeHousehold=h;localStorage.setItem('dapurkuActiveHousehold',id);unsubscribeCloud();cloudStatus='Syncing…';scheduleRender();
  await flushSyncQueue();
  const {data,error}=await cloudClient.from('dapurku_records').select('household_id,store,record_id,payload,is_deleted,updated_at').eq('household_id',id);if(error)throw error;
  if(!data?.length)await uploadLocalSnapshot();else await replaceLocalFromCloud(data);
  lastCloudPullAt=Date.now();subscribeCloud();cloudMembers=await getCloudMembers();cloudStatus=navigator.onLine?'Synced':'Offline · changes pending';if(showToast)toast(`Using ${h.name}`);scheduleRender();
}
async function resumeCloudSync(force=false){
  if(cloudResumeBusy||!cloudClient||!cloudUser||!navigator.onLine)return;
  if(!force&&Date.now()-lastCloudPullAt<5000)return;
  cloudResumeBusy=true;cloudStatus='Syncing…';scheduleRender();
  try{
    try{await cloudClient.auth.startAutoRefresh()}catch{}
    await refreshHouseholds();
    const current=activeHousehold&&cloudHouseholds.find(h=>h.id===activeHousehold.id);
    const shared=cloudHouseholds.find(h=>h.membership?.role==='member');
    const target=current||shared||cloudHouseholds.find(h=>h.owner_id===cloudUser.id)||cloudHouseholds[0];
    if(target)await activateHousehold(target.id,{showToast:false});
  }catch(err){cloudStatus='Sync issue · tap Sync Now';console.warn('DapurKu resume sync:',err.message)}finally{cloudResumeBusy=false;scheduleRender()}
}
async function uploadLocalSnapshot(){
  if(!activeHousehold||!cloudClient)return;const rows=[];for(const store of ['items','shopping','history','recipes']){let vals=await getAll(store);if(store==='recipes')vals=vals.filter(v=>!/^r\d+$/.test(String(v.id||'')));for(const v of vals)rows.push({household_id:activeHousehold.id,store,record_id:String(v.id),payload:v,is_deleted:false,updated_at:new Date().toISOString(),updated_by:cloudUser.id})}
  if(rows.length){const {error}=await cloudClient.from('dapurku_records').upsert(rows,{onConflict:'household_id,store,record_id'});if(error)throw error}
}
async function replaceLocalFromCloud(rows){
  suppressCloudSync=true;try{for(const st of ['items','shopping','history'])await clearStore(st);const recipes=await getAll('recipes');for(const r of recipes.filter(x=>!/^r\d+$/.test(String(x.id||''))))await delRaw('recipes',r.id);for(const row of rows){if(row.is_deleted)continue;if(!row.payload||!syncableRecord(row.store,row.payload))continue;await putRaw(row.store,row.payload)}await ensureRecipeLibrary()}finally{suppressCloudSync=false}
}
function subscribeCloud(){
  if(!cloudClient||!activeHousehold)return;cloudChannel=cloudClient.channel(`dapurku-${activeHousehold.id}`).on('postgres_changes',{event:'*',schema:'public',table:'dapurku_records',filter:`household_id=eq.${activeHousehold.id}`},async payload=>{const row=payload.new||payload.old;if(!row||row.household_id!==activeHousehold.id)return;suppressCloudSync=true;try{if(row.is_deleted)await delRaw(row.store,row.record_id);else if(row.payload&&syncableRecord(row.store,row.payload))await putRaw(row.store,row.payload)}finally{suppressCloudSync=false}cloudStatus='Synced';scheduleRender()}).subscribe();
}
function unsubscribeCloud(){if(cloudClient&&cloudChannel){cloudClient.removeChannel(cloudChannel).catch?.(()=>{});cloudChannel=null}}
async function flushSyncQueue(){
  if(cloudBusy||!cloudClient||!cloudUser||!activeHousehold||!navigator.onLine)return;let q=readSyncQueue();const current=q.filter(x=>(x.householdId||activeHousehold.id)===activeHousehold.id);if(!current.length){cloudStatus='Synced';return}cloudBusy=true;cloudStatus='Syncing…';try{const rows=current.map(x=>({household_id:activeHousehold.id,store:x.store,record_id:String(x.id),payload:x.isDeleted?null:x.payload,is_deleted:!!x.isDeleted,updated_at:new Date().toISOString(),updated_by:cloudUser.id}));const {error}=await cloudClient.from('dapurku_records').upsert(rows,{onConflict:'household_id,store,record_id'});if(error)throw error;const sent=new Set(current.map(x=>x.key));writeSyncQueue(q.filter(x=>!sent.has(x.key)));cloudStatus='Synced'}catch(err){cloudStatus='Offline · changes pending';console.warn('DapurKu sync:',err.message)}finally{cloudBusy=false;scheduleRender()}}
async function cloudSignIn(email,password){if(!cloudConfigured)throw new Error('Supabase is not configured yet.');const {error}=await cloudClient.auth.signInWithPassword({email,password});if(error)throw error}
async function cloudSignUp(email,password){if(!cloudConfigured)throw new Error('Supabase is not configured yet.');const {data,error}=await cloudClient.auth.signUp({email,password});if(error)throw error;return data}
async function cloudSignOut(){if(!cloudClient)return;await cloudClient.auth.signOut();cloudUser=null;activeHousehold=null;cloudHouseholds=[];cloudMembers=[];unsubscribeCloud();cloudStatus='Signed out';scheduleRender()}
async function inviteSyncEmail(email){if(!cloudClient||!cloudUser||!activeHousehold)throw new Error('Sign in first.');const {error}=await cloudClient.rpc('dapurku_invite_email',{p_household_id:activeHousehold.id,p_email:email});if(error)throw error;cloudMembers=await getCloudMembers()}
async function getCloudMembers(){if(!cloudClient||!activeHousehold)return[];const {data,error}=await cloudClient.from('dapurku_members').select('email,role,user_id,created_at').eq('household_id',activeHousehold.id).order('created_at');if(error)return[];return data||[]}
async function switchCloudHousehold(id){await refreshHouseholds();await activateHousehold(id);}
window.addEventListener('online',()=>{cloudStatus=cloudUser?'Syncing…':'Local only';resumeCloudSync(true).catch(()=>{});scheduleRender()});window.addEventListener('offline',()=>{cloudStatus=cloudUser?'Offline · changes pending':'Local only';scheduleRender()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resumeCloudSync().catch(()=>{})});
window.addEventListener('pageshow',()=>{resumeCloudSync().catch(()=>{})});

const seedRecipes=[
  {
    "id": "r1",
    "title": "Ayam Masak Lemak Cili Api",
    "category": "Malay Classics",
    "time": 45,
    "sourceName": "Che Nom",
    "sourceUrl": "https://resepichenom.com/resepi/ayam-masak-lemak-cili-api-sedap",
    "note": "Pantry checklist inspired by the linked Che Nom recipe. Open the official source for exact quantities and cooking method.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "fresh turmeric"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "potato"
      },
      {
        "name": "turmeric leaf"
      },
      {
        "name": "asam gelugur"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r2",
    "title": "Udang Galah Masak Lemak Cili Api",
    "category": "Malay Classics",
    "time": 40,
    "sourceName": "Che Nom",
    "sourceUrl": "https://resepichenom.com/resepi/udang-galah-masak-lemak-cili-api",
    "note": "Pantry checklist linked to Che Nom for the full recipe and method.",
    "ingredients": [
      {
        "name": "river prawns"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "fresh turmeric"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "turmeric leaf"
      },
      {
        "name": "long beans"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r3",
    "title": "Pucuk Paku Masak Lemak Cili Api",
    "category": "Malay Classics",
    "time": 30,
    "sourceName": "Che Nom",
    "sourceUrl": "https://resepichenom.com/resepi/pucuk-paku-masak-lemak-cili-api",
    "note": "Pantry checklist linked to Che Nom for the full recipe and method.",
    "ingredients": [
      {
        "name": "fiddlehead fern"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "anchovies"
      },
      {
        "name": "shallot"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "fresh turmeric"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r4",
    "title": "Ikan Siakap Masak Lemak Cili Api",
    "category": "Fish & Seafood",
    "time": 40,
    "sourceName": "Che Nom",
    "sourceUrl": "https://resepichenom.com/resepi/ikan-siakap-masak-lemak-cili-api-pekat-pedas-masam-isi-tak-hancur",
    "note": "Pantry checklist linked to Che Nom for the full recipe and method.",
    "ingredients": [
      {
        "name": "barramundi"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "fresh turmeric"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "turmeric leaf"
      },
      {
        "name": "asam gelugur"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r5",
    "title": "Spaghetti Masak Lemak Cili Api Udang",
    "category": "Pasta & Fusion",
    "time": 45,
    "sourceName": "Che Nom",
    "sourceUrl": "https://resepichenom.com/resepi/spaghetti-masak-lemak-cili-api-udang",
    "note": "Pantry checklist linked to Che Nom for the full recipe and method.",
    "ingredients": [
      {
        "name": "spaghetti"
      },
      {
        "name": "prawns"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "fresh turmeric"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "turmeric leaf"
      },
      {
        "name": "cherry tomato"
      },
      {
        "name": "cooking cream"
      },
      {
        "name": "lemon"
      }
    ]
  },
  {
    "id": "r6",
    "title": "Daging Masak Lemak Cili Api",
    "category": "Malay Classics",
    "time": 55,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "beef"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "fresh turmeric"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "asam gelugur"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r7",
    "title": "Ketam Masak Lemak Cili Api",
    "category": "Fish & Seafood",
    "time": 40,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "crab"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "fresh turmeric"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "turmeric leaf"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r8",
    "title": "Udang Masak Lemak Nenas",
    "category": "Fish & Seafood",
    "time": 35,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "prawns"
      },
      {
        "name": "pineapple"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "fresh turmeric"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r9",
    "title": "Ayam Masak Kicap",
    "category": "Malay Classics",
    "time": 35,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "sweet soy sauce"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "red chilli"
      },
      {
        "name": "potato"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r10",
    "title": "Ayam Masak Merah",
    "category": "Malay Classics",
    "time": 50,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "tomato sauce"
      },
      {
        "name": "chilli sauce"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "peas"
      },
      {
        "name": "salt"
      },
      {
        "name": "sugar"
      }
    ]
  },
  {
    "id": "r11",
    "title": "Ayam Goreng Berempah",
    "category": "Malay Classics",
    "time": 45,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "galangal"
      },
      {
        "name": "ginger"
      },
      {
        "name": "garlic"
      },
      {
        "name": "coriander powder"
      },
      {
        "name": "fennel powder"
      },
      {
        "name": "cumin powder"
      },
      {
        "name": "curry leaf"
      },
      {
        "name": "turmeric powder"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r12",
    "title": "Ayam Percik",
    "category": "Malay Classics",
    "time": 60,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "tamarind"
      },
      {
        "name": "sugar"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r13",
    "title": "Rendang Ayam",
    "category": "Malay Classics",
    "time": 90,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "galangal"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "turmeric leaf"
      },
      {
        "name": "kaffir lime leaf"
      },
      {
        "name": "toasted coconut paste"
      }
    ]
  },
  {
    "id": "r14",
    "title": "Rendang Daging",
    "category": "Malay Classics",
    "time": 120,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "beef"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "galangal"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "turmeric leaf"
      },
      {
        "name": "kaffir lime leaf"
      },
      {
        "name": "toasted coconut paste"
      }
    ]
  },
  {
    "id": "r15",
    "title": "Daging Masak Hitam",
    "category": "Malay Classics",
    "time": 70,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "beef"
      },
      {
        "name": "sweet soy sauce"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "cinnamon"
      },
      {
        "name": "star anise"
      },
      {
        "name": "clove"
      },
      {
        "name": "cardamom"
      },
      {
        "name": "tamarind"
      },
      {
        "name": "sugar"
      }
    ]
  },
  {
    "id": "r16",
    "title": "Daging Kurma",
    "category": "Malay Classics",
    "time": 60,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "beef"
      },
      {
        "name": "kurma powder"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "potato"
      },
      {
        "name": "carrot"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "cinnamon"
      },
      {
        "name": "star anise"
      },
      {
        "name": "clove"
      },
      {
        "name": "cardamom"
      }
    ]
  },
  {
    "id": "r17",
    "title": "Daging Kerutuk",
    "category": "Malay Classics",
    "time": 80,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "beef"
      },
      {
        "name": "kerutuk spice"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "toasted coconut paste"
      },
      {
        "name": "palm sugar"
      }
    ]
  },
  {
    "id": "r18",
    "title": "Sambal Tumis Ikan Bilis",
    "category": "Malay Classics",
    "time": 35,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "anchovies"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "tamarind"
      },
      {
        "name": "sugar"
      },
      {
        "name": "salt"
      },
      {
        "name": "cooking oil"
      }
    ]
  },
  {
    "id": "r19",
    "title": "Sambal Sotong",
    "category": "Fish & Seafood",
    "time": 45,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "squid"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "tamarind"
      },
      {
        "name": "palm sugar"
      },
      {
        "name": "oyster sauce"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r20",
    "title": "Sambal Udang Petai",
    "category": "Fish & Seafood",
    "time": 40,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "prawns"
      },
      {
        "name": "petai"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "tamarind"
      },
      {
        "name": "sugar"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r21",
    "title": "Asam Pedas Ikan",
    "category": "Fish & Seafood",
    "time": 50,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "mackerel"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "tamarind"
      },
      {
        "name": "okra"
      },
      {
        "name": "tomato"
      },
      {
        "name": "daun kesum"
      },
      {
        "name": "torch ginger"
      }
    ]
  },
  {
    "id": "r22",
    "title": "Singgang Ikan",
    "category": "Fish & Seafood",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "mackerel"
      },
      {
        "name": "galangal"
      },
      {
        "name": "fresh turmeric"
      },
      {
        "name": "garlic"
      },
      {
        "name": "asam gelugur"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "okra"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r23",
    "title": "Ikan Goreng Berlada",
    "category": "Fish & Seafood",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "mackerel"
      },
      {
        "name": "red chilli"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "lime"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r24",
    "title": "Ikan Masak Kicap",
    "category": "Fish & Seafood",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "fish"
      },
      {
        "name": "sweet soy sauce"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "red chilli"
      },
      {
        "name": "tomato"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r25",
    "title": "Siakap Tiga Rasa",
    "category": "Fish & Seafood",
    "time": 45,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "barramundi"
      },
      {
        "name": "garlic"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "red chilli"
      },
      {
        "name": "pineapple"
      },
      {
        "name": "chilli sauce"
      },
      {
        "name": "tomato sauce"
      },
      {
        "name": "fish sauce"
      },
      {
        "name": "lime"
      }
    ]
  },
  {
    "id": "r26",
    "title": "Siakap Stim Limau",
    "category": "Fish & Seafood",
    "time": 35,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "barramundi"
      },
      {
        "name": "lime"
      },
      {
        "name": "garlic"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "fish sauce"
      },
      {
        "name": "coriander"
      },
      {
        "name": "ginger"
      },
      {
        "name": "sugar"
      }
    ]
  },
  {
    "id": "r27",
    "title": "Ikan Sweet & Sour",
    "category": "Fish & Seafood",
    "time": 35,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "fish"
      },
      {
        "name": "onion"
      },
      {
        "name": "bell pepper"
      },
      {
        "name": "pineapple"
      },
      {
        "name": "tomato sauce"
      },
      {
        "name": "chilli sauce"
      },
      {
        "name": "vinegar"
      },
      {
        "name": "sugar"
      }
    ]
  },
  {
    "id": "r28",
    "title": "Telur Sambal",
    "category": "Eggs & Tofu",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "egg"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "tamarind"
      },
      {
        "name": "sugar"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r29",
    "title": "Telur Masak Kicap",
    "category": "Eggs & Tofu",
    "time": 20,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "egg"
      },
      {
        "name": "sweet soy sauce"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r30",
    "title": "Telur Dadar Bawang Cili",
    "category": "Eggs & Tofu",
    "time": 15,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "egg"
      },
      {
        "name": "onion"
      },
      {
        "name": "red chilli"
      },
      {
        "name": "spring onion"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r31",
    "title": "Tauhu Sambal",
    "category": "Eggs & Tofu",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "tofu"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "tamarind"
      },
      {
        "name": "sugar"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r32",
    "title": "Tauhu Telur Sos Tiram",
    "category": "Eggs & Tofu",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "tofu"
      },
      {
        "name": "egg"
      },
      {
        "name": "oyster sauce"
      },
      {
        "name": "garlic"
      },
      {
        "name": "spring onion"
      },
      {
        "name": "red chilli"
      }
    ]
  },
  {
    "id": "r33",
    "title": "Kangkung Belacan",
    "category": "Vegetables",
    "time": 20,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "water spinach"
      },
      {
        "name": "belacan"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "garlic"
      },
      {
        "name": "shallot"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r34",
    "title": "Kailan Ikan Masin",
    "category": "Vegetables",
    "time": 20,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "kailan"
      },
      {
        "name": "salted fish"
      },
      {
        "name": "garlic"
      },
      {
        "name": "oyster sauce"
      },
      {
        "name": "bird’s eye chilli"
      }
    ]
  },
  {
    "id": "r35",
    "title": "Sayur Campur Goreng",
    "category": "Vegetables",
    "time": 20,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "broccoli"
      },
      {
        "name": "carrot"
      },
      {
        "name": "cauliflower"
      },
      {
        "name": "baby corn"
      },
      {
        "name": "garlic"
      },
      {
        "name": "oyster sauce"
      }
    ]
  },
  {
    "id": "r36",
    "title": "Sawi Goreng Bawang Putih",
    "category": "Vegetables",
    "time": 15,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "mustard greens"
      },
      {
        "name": "garlic"
      },
      {
        "name": "oyster sauce"
      },
      {
        "name": "cooking oil"
      }
    ]
  },
  {
    "id": "r37",
    "title": "Terung Berlada",
    "category": "Vegetables",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "eggplant"
      },
      {
        "name": "red chilli"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r38",
    "title": "Sambal Goreng Jawa",
    "category": "Vegetables",
    "time": 45,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "tempeh"
      },
      {
        "name": "tofu"
      },
      {
        "name": "long beans"
      },
      {
        "name": "glass noodles"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "sweet soy sauce"
      }
    ]
  },
  {
    "id": "r39",
    "title": "Sup Ayam",
    "category": "Soups",
    "time": 45,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "potato"
      },
      {
        "name": "carrot"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "soup spice"
      },
      {
        "name": "celery leaf"
      },
      {
        "name": "fried shallot"
      }
    ]
  },
  {
    "id": "r40",
    "title": "Sup Daging",
    "category": "Soups",
    "time": 60,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "beef"
      },
      {
        "name": "potato"
      },
      {
        "name": "carrot"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "soup spice"
      },
      {
        "name": "celery leaf"
      },
      {
        "name": "fried shallot"
      }
    ]
  },
  {
    "id": "r41",
    "title": "Sup Tulang",
    "category": "Soups",
    "time": 90,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "beef bones"
      },
      {
        "name": "potato"
      },
      {
        "name": "carrot"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "soup spice"
      },
      {
        "name": "celery leaf"
      },
      {
        "name": "tomato"
      }
    ]
  },
  {
    "id": "r42",
    "title": "Soto Ayam",
    "category": "Soups",
    "time": 75,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "rice vermicelli"
      },
      {
        "name": "potato"
      },
      {
        "name": "bean sprouts"
      },
      {
        "name": "soto spice"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "celery leaf"
      }
    ]
  },
  {
    "id": "r43",
    "title": "Nasi Goreng Kampung",
    "category": "Rice & Noodles",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "cooked rice"
      },
      {
        "name": "anchovies"
      },
      {
        "name": "egg"
      },
      {
        "name": "water spinach"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "sweet soy sauce"
      }
    ]
  },
  {
    "id": "r44",
    "title": "Nasi Goreng Cina",
    "category": "Rice & Noodles",
    "time": 20,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "cooked rice"
      },
      {
        "name": "egg"
      },
      {
        "name": "carrot"
      },
      {
        "name": "spring onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "white pepper"
      },
      {
        "name": "soy sauce"
      }
    ]
  },
  {
    "id": "r45",
    "title": "Nasi Goreng Pattaya",
    "category": "Rice & Noodles",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "cooked rice"
      },
      {
        "name": "egg"
      },
      {
        "name": "chicken"
      },
      {
        "name": "mixed vegetables"
      },
      {
        "name": "garlic"
      },
      {
        "name": "chilli sauce"
      },
      {
        "name": "tomato sauce"
      }
    ]
  },
  {
    "id": "r46",
    "title": "Nasi Goreng Ikan Masin",
    "category": "Rice & Noodles",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "cooked rice"
      },
      {
        "name": "salted fish"
      },
      {
        "name": "egg"
      },
      {
        "name": "mustard greens"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "garlic"
      }
    ]
  },
  {
    "id": "r47",
    "title": "Nasi Goreng Tomyam",
    "category": "Rice & Noodles",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "cooked rice"
      },
      {
        "name": "tom yum paste"
      },
      {
        "name": "chicken"
      },
      {
        "name": "egg"
      },
      {
        "name": "mixed vegetables"
      },
      {
        "name": "garlic"
      },
      {
        "name": "kaffir lime leaf"
      }
    ]
  },
  {
    "id": "r48",
    "title": "Nasi Lemak",
    "category": "Rice & Noodles",
    "time": 60,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "rice"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "pandan leaf"
      },
      {
        "name": "anchovies"
      },
      {
        "name": "peanuts"
      },
      {
        "name": "egg"
      },
      {
        "name": "cucumber"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "tamarind"
      }
    ]
  },
  {
    "id": "r49",
    "title": "Nasi Tomato",
    "category": "Rice & Noodles",
    "time": 60,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "rice"
      },
      {
        "name": "tomato puree"
      },
      {
        "name": "evaporated milk"
      },
      {
        "name": "ghee"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "cinnamon"
      },
      {
        "name": "star anise"
      },
      {
        "name": "clove"
      },
      {
        "name": "cardamom"
      }
    ]
  },
  {
    "id": "r50",
    "title": "Nasi Minyak",
    "category": "Rice & Noodles",
    "time": 60,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "basmati rice"
      },
      {
        "name": "ghee"
      },
      {
        "name": "evaporated milk"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "cinnamon"
      },
      {
        "name": "star anise"
      },
      {
        "name": "clove"
      },
      {
        "name": "cardamom"
      },
      {
        "name": "raisins"
      }
    ]
  },
  {
    "id": "r51",
    "title": "Nasi Ayam",
    "category": "Rice & Noodles",
    "time": 80,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "rice"
      },
      {
        "name": "ginger"
      },
      {
        "name": "garlic"
      },
      {
        "name": "sesame oil"
      },
      {
        "name": "soy sauce"
      },
      {
        "name": "cucumber"
      },
      {
        "name": "chilli sauce"
      },
      {
        "name": "spring onion"
      }
    ]
  },
  {
    "id": "r52",
    "title": "Mee Goreng Mamak",
    "category": "Rice & Noodles",
    "time": 35,
    "sourceName": "Che Nom",
    "sourceUrl": "https://resepichenom.com/resepi/mee-goreng-mamak",
    "note": "DapurKu pantry checklist linked to the official Che Nom recipe. Open the source for exact quantities and cooking method.",
    "ingredients": [
      {
        "name": "yellow noodles"
      },
      {
        "name": "tofu"
      },
      {
        "name": "bean sprouts"
      },
      {
        "name": "egg"
      },
      {
        "name": "potato"
      },
      {
        "name": "mustard greens"
      },
      {
        "name": "chilli sauce"
      },
      {
        "name": "sweet soy sauce"
      },
      {
        "name": "lime"
      }
    ]
  },
  {
    "id": "r53",
    "title": "Bihun Goreng",
    "category": "Rice & Noodles",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "rice vermicelli"
      },
      {
        "name": "egg"
      },
      {
        "name": "mustard greens"
      },
      {
        "name": "carrot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "shallot"
      },
      {
        "name": "oyster sauce"
      },
      {
        "name": "sweet soy sauce"
      }
    ]
  },
  {
    "id": "r54",
    "title": "Kuey Teow Goreng",
    "category": "Rice & Noodles",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "flat rice noodles"
      },
      {
        "name": "prawns"
      },
      {
        "name": "egg"
      },
      {
        "name": "bean sprouts"
      },
      {
        "name": "chives"
      },
      {
        "name": "garlic"
      },
      {
        "name": "soy sauce"
      },
      {
        "name": "chilli paste"
      }
    ]
  },
  {
    "id": "r55",
    "title": "Mee Kari",
    "category": "Rice & Noodles",
    "time": 70,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "yellow noodles"
      },
      {
        "name": "chicken"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "curry powder"
      },
      {
        "name": "tofu puff"
      },
      {
        "name": "bean sprouts"
      },
      {
        "name": "fish cake"
      },
      {
        "name": "egg"
      },
      {
        "name": "mustard greens"
      }
    ]
  },
  {
    "id": "r56",
    "title": "Mee Rebus",
    "category": "Rice & Noodles",
    "time": 75,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "yellow noodles"
      },
      {
        "name": "sweet potato"
      },
      {
        "name": "beef"
      },
      {
        "name": "bean sprouts"
      },
      {
        "name": "tofu"
      },
      {
        "name": "egg"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "lime"
      }
    ]
  },
  {
    "id": "r57",
    "title": "Asam Laksa",
    "category": "Rice & Noodles",
    "time": 90,
    "sourceName": "Che Nom",
    "sourceUrl": "https://resepichenom.com/resepi/asam-laksa-penang",
    "note": "DapurKu pantry checklist linked to the official Che Nom recipe. Open the source for exact quantities and cooking method.",
    "ingredients": [
      {
        "name": "laksa noodles"
      },
      {
        "name": "mackerel"
      },
      {
        "name": "asam gelugur"
      },
      {
        "name": "daun kesum"
      },
      {
        "name": "torch ginger"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "onion"
      },
      {
        "name": "cucumber"
      },
      {
        "name": "pineapple"
      }
    ]
  },
  {
    "id": "r58",
    "title": "Laksa Johor",
    "category": "Rice & Noodles",
    "time": 100,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "spaghetti"
      },
      {
        "name": "mackerel"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "dried chilli"
      },
      {
        "name": "onion"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "galangal"
      },
      {
        "name": "daun kesum"
      },
      {
        "name": "cucumber"
      }
    ]
  },
  {
    "id": "r59",
    "title": "Tomyam Ayam",
    "category": "Thai & Mamak",
    "time": 35,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "tom yum paste"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "kaffir lime leaf"
      },
      {
        "name": "galangal"
      },
      {
        "name": "mushroom"
      },
      {
        "name": "tomato"
      },
      {
        "name": "onion"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "lime"
      }
    ]
  },
  {
    "id": "r60",
    "title": "Tomyam Seafood",
    "category": "Thai & Mamak",
    "time": 40,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "prawns"
      },
      {
        "name": "squid"
      },
      {
        "name": "fish"
      },
      {
        "name": "tom yum paste"
      },
      {
        "name": "lemongrass"
      },
      {
        "name": "kaffir lime leaf"
      },
      {
        "name": "galangal"
      },
      {
        "name": "mushroom"
      },
      {
        "name": "tomato"
      },
      {
        "name": "lime"
      }
    ]
  },
  {
    "id": "r61",
    "title": "Ayam Goreng Kunyit",
    "category": "Thai & Mamak",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "turmeric powder"
      },
      {
        "name": "long beans"
      },
      {
        "name": "carrot"
      },
      {
        "name": "onion"
      },
      {
        "name": "red chilli"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r62",
    "title": "Daging Goreng Kunyit",
    "category": "Thai & Mamak",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "beef"
      },
      {
        "name": "turmeric powder"
      },
      {
        "name": "long beans"
      },
      {
        "name": "carrot"
      },
      {
        "name": "onion"
      },
      {
        "name": "red chilli"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r63",
    "title": "Pad Kra Pao Ayam",
    "category": "Thai & Mamak",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "minced chicken"
      },
      {
        "name": "thai basil"
      },
      {
        "name": "garlic"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "fish sauce"
      },
      {
        "name": "oyster sauce"
      },
      {
        "name": "egg"
      }
    ]
  },
  {
    "id": "r64",
    "title": "Ayam Masak Madu Ala Mamak",
    "category": "Thai & Mamak",
    "time": 50,
    "sourceName": "Che Nom",
    "sourceUrl": "https://resepichenom.com/resepi/ayam-masak-madu-ala-mamak-che-nom",
    "note": "DapurKu pantry checklist linked to the official Che Nom recipe. Open the source for exact quantities and cooking method.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "honey"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "chilli sauce"
      },
      {
        "name": "tomato soup"
      },
      {
        "name": "curry leaf"
      }
    ]
  },
  {
    "id": "r65",
    "title": "Sardin Sambal",
    "category": "Quick Meals",
    "time": 20,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "canned sardine"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "bird’s eye chilli"
      },
      {
        "name": "tamarind"
      },
      {
        "name": "tomato"
      }
    ]
  },
  {
    "id": "r66",
    "title": "Sardin Masak Kicap",
    "category": "Quick Meals",
    "time": 15,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "canned sardine"
      },
      {
        "name": "sweet soy sauce"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "bird’s eye chilli"
      }
    ]
  },
  {
    "id": "r67",
    "title": "Tuna Egg Fried Rice",
    "category": "Quick Meals",
    "time": 20,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "cooked rice"
      },
      {
        "name": "canned tuna"
      },
      {
        "name": "egg"
      },
      {
        "name": "garlic"
      },
      {
        "name": "spring onion"
      },
      {
        "name": "soy sauce"
      }
    ]
  },
  {
    "id": "r68",
    "title": "Egg Fried Rice",
    "category": "Quick Meals",
    "time": 15,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "cooked rice"
      },
      {
        "name": "egg"
      },
      {
        "name": "garlic"
      },
      {
        "name": "spring onion"
      },
      {
        "name": "soy sauce"
      },
      {
        "name": "white pepper"
      }
    ]
  },
  {
    "id": "r69",
    "title": "Maggi Goreng Mamak",
    "category": "Quick Meals",
    "time": 15,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "instant noodles"
      },
      {
        "name": "egg"
      },
      {
        "name": "tofu"
      },
      {
        "name": "mustard greens"
      },
      {
        "name": "chilli sauce"
      },
      {
        "name": "sweet soy sauce"
      },
      {
        "name": "lime"
      }
    ]
  },
  {
    "id": "r70",
    "title": "Roti Telur Sardin",
    "category": "Quick Meals",
    "time": 15,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "bread"
      },
      {
        "name": "egg"
      },
      {
        "name": "canned sardine"
      },
      {
        "name": "onion"
      },
      {
        "name": "bird’s eye chilli"
      }
    ]
  },
  {
    "id": "r71",
    "title": "Bubur Ayam",
    "category": "Quick Meals",
    "time": 45,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "rice"
      },
      {
        "name": "chicken"
      },
      {
        "name": "ginger"
      },
      {
        "name": "garlic"
      },
      {
        "name": "spring onion"
      },
      {
        "name": "fried shallot"
      },
      {
        "name": "soy sauce"
      }
    ]
  },
  {
    "id": "r72",
    "title": "Spaghetti Aglio Olio",
    "category": "Pasta & Fusion",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "spaghetti"
      },
      {
        "name": "garlic"
      },
      {
        "name": "olive oil"
      },
      {
        "name": "dried chilli flakes"
      },
      {
        "name": "parsley"
      },
      {
        "name": "prawns"
      }
    ]
  },
  {
    "id": "r73",
    "title": "Spaghetti Bolognese",
    "category": "Pasta & Fusion",
    "time": 40,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "spaghetti"
      },
      {
        "name": "minced beef"
      },
      {
        "name": "onion"
      },
      {
        "name": "garlic"
      },
      {
        "name": "tomato puree"
      },
      {
        "name": "tomato sauce"
      },
      {
        "name": "mixed herbs"
      }
    ]
  },
  {
    "id": "r74",
    "title": "Creamy Chicken Pasta",
    "category": "Pasta & Fusion",
    "time": 35,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "pasta"
      },
      {
        "name": "chicken"
      },
      {
        "name": "cooking cream"
      },
      {
        "name": "garlic"
      },
      {
        "name": "mushroom"
      },
      {
        "name": "parmesan cheese"
      },
      {
        "name": "black pepper"
      }
    ]
  },
  {
    "id": "r75",
    "title": "Chicken Chop Black Pepper",
    "category": "Pasta & Fusion",
    "time": 45,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "black pepper sauce"
      },
      {
        "name": "potato"
      },
      {
        "name": "mixed vegetables"
      },
      {
        "name": "garlic"
      },
      {
        "name": "butter"
      }
    ]
  },
  {
    "id": "r76",
    "title": "Mac & Cheese",
    "category": "Pasta & Fusion",
    "time": 30,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "macaroni"
      },
      {
        "name": "cheddar cheese"
      },
      {
        "name": "milk"
      },
      {
        "name": "butter"
      },
      {
        "name": "flour"
      },
      {
        "name": "black pepper"
      }
    ]
  },
  {
    "id": "r77",
    "title": "Lempeng Kelapa",
    "category": "Breakfast & Snacks",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "flour"
      },
      {
        "name": "grated coconut"
      },
      {
        "name": "water"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r78",
    "title": "Cekodok Pisang",
    "category": "Breakfast & Snacks",
    "time": 25,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "banana"
      },
      {
        "name": "flour"
      },
      {
        "name": "sugar"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r79",
    "title": "Cucur Udang",
    "category": "Breakfast & Snacks",
    "time": 35,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "flour"
      },
      {
        "name": "prawns"
      },
      {
        "name": "bean sprouts"
      },
      {
        "name": "chives"
      },
      {
        "name": "onion"
      },
      {
        "name": "turmeric powder"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r80",
    "title": "Cucur Bawang",
    "category": "Breakfast & Snacks",
    "time": 20,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "flour"
      },
      {
        "name": "onion"
      },
      {
        "name": "anchovies"
      },
      {
        "name": "chives"
      },
      {
        "name": "salt"
      }
    ]
  },
  {
    "id": "r81",
    "title": "Roti Jala & Kari Ayam",
    "category": "Breakfast & Snacks",
    "time": 60,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "flour"
      },
      {
        "name": "egg"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "turmeric powder"
      },
      {
        "name": "chicken"
      },
      {
        "name": "curry powder"
      },
      {
        "name": "potato"
      },
      {
        "name": "onion"
      }
    ]
  },
  {
    "id": "r82",
    "title": "French Toast",
    "category": "Breakfast & Snacks",
    "time": 15,
    "sourceName": "DapurKu",
    "sourceUrl": "",
    "note": "Ingredient-planning checklist for pantry matching. Adjust quantities to your preferred serving size.",
    "ingredients": [
      {
        "name": "bread"
      },
      {
        "name": "egg"
      },
      {
        "name": "milk"
      },
      {
        "name": "butter"
      },
      {
        "name": "sugar"
      }
    ]
  },
  {
    "id": "r83",
    "title": "Kari Ayam Istimewa",
    "category": "Malay Classics",
    "time": 35,
    "sourceName": "Che Nom",
    "sourceUrl": "https://resepichenom.com/resepi/kari-ayam-istimewa",
    "note": "DapurKu pantry checklist linked to the official Che Nom recipe. Open the source for exact quantities and cooking method.",
    "ingredients": [
      {
        "name": "chicken"
      },
      {
        "name": "curry powder"
      },
      {
        "name": "chilli powder"
      },
      {
        "name": "curry leaf"
      },
      {
        "name": "coconut milk"
      },
      {
        "name": "toasted coconut paste"
      },
      {
        "name": "potato"
      },
      {
        "name": "shallot"
      },
      {
        "name": "garlic"
      },
      {
        "name": "ginger"
      },
      {
        "name": "cinnamon"
      },
      {
        "name": "star anise"
      },
      {
        "name": "cardamom"
      },
      {
        "name": "salt"
      }
    ]
  }
];

function isoMinus(days){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
function isoPlus(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}

const seedItems=[
  ['Chicken','Segar','in',false,isoPlus(18),'',1,'pack'],['Coconut milk','Barang Kering','low',true,isoPlus(90),'',1,'box'],
  ["Bird’s eye chilli",'Segar','out',true,isoPlus(5),'',1,'pack'],['Lemongrass','Segar','in',false,isoPlus(7),'',5,'stalks'],
  ['Salt','Sos & Perencah','in',true,'','',1,'pack'],['Egg','Tenusu','low',true,isoPlus(9),'',8,'pcs'],['Milo','Minuman','out',true,isoPlus(180),'9556001122334',1,'pack'],
  ['Cooking oil','Sos & Perencah','low',true,isoPlus(120),'',1,'bottle'],['Onion','Segar','in',true,isoPlus(12),'',4,'pcs'],['Garlic','Segar','in',true,isoPlus(20),'',1,'bulb'],
  ['Ginger','Segar','in',false,isoPlus(12),'',1,'piece'],['Potato','Segar','in',false,isoPlus(15),'',5,'pcs'],['Fresh milk','Tenusu','in',true,isoPlus(2),'',1,'bottle'],
  ['Yogurt','Tenusu','in',false,isoPlus(4),'',2,'cups'],['Sweet soy sauce','Sos & Perencah','in',true,isoPlus(200),'',1,'bottle'],['Fresh turmeric','Segar','in',false,isoPlus(10),'',1,'piece']
].map((x,i)=>({id:`i${i+1}`,name:x[0],category:x[1],status:x[2],favorite:x[3],expiry:x[4],barcode:x[5],qty:x[6],unit:x[7],createdAt:todayISO(),updatedAt:todayISO()}));
const seedHistory=[
  {id:'h1',date:isoMinus(62),store:'Lotus',total:96.20,items:[{name:'Milo'},{name:'Egg'},{name:'Cooking oil'},{name:'Coconut milk'}]},
  {id:'h2',date:isoMinus(35),store:'Lotus',total:84.50,items:[{name:'Milo'},{name:'Egg'},{name:'Coconut milk'}]},
  {id:'h3',date:isoMinus(8),store:'NSK',total:72.10,items:[{name:'Milo'},{name:'Egg'},{name:'Cooking oil'}]}
];

async function ensureRecipeLibrary(){
  const existing=await getAll('recipes');
  const custom=existing.filter(r=>!String(r.id).match(/^r\d+$/));
  for(const r of seedRecipes) await put('recipes',r);
  for(const r of custom) await put('recipes',r);
  await put('settings',{id:'recipeLibraryVersion',value:3});
}

async function seedIfNeeded(){
  const initialized=await getOne('settings','initialized');
  if(!initialized){
    for(const i of seedItems)await put('items',i);for(const h of seedHistory)await put('history',h);
    await put('settings',{id:'initialized',value:true});await put('settings',{id:'demo',value:true});
  }
  const lib=await getOne('settings','recipeLibraryVersion');
  if(!lib||lib.value<3)await ensureRecipeLibrary();
  await syncAutoShopping();
}

async function syncAutoShopping(){
  const items=await getAll('items');let shopping=await getAll('shopping');
  for(const item of items){
    const existing=shopping.find(s=>s.itemId===item.id&&s.source==='auto');
    const autoDismissed=(item.status==='low'||item.status==='out')&&item.autoShoppingDismissedStatus===item.status;
    if(item.status==='low'||item.status==='out'){
      if(autoDismissed){
        if(existing){await del('shopping',existing.id);shopping=shopping.filter(s=>s.id!==existing.id)}
        continue;
      }
      if(!existing){const entry={id:uid(),itemId:item.id,name:item.name,category:categoryLabel(item.category||'Lain-lain'),icon:itemIcon(item),qty:1,unit:item.unit||'',checked:false,source:'auto',reason:item.status,createdAt:new Date().toISOString()};await put('shopping',entry);shopping.push(entry)}
      else if(existing.reason!==item.status||existing.name!==item.name){existing.reason=item.status;existing.name=item.name;existing.category=categoryLabel(item.category||existing.category);existing.icon=itemIcon(item);await put('shopping',existing)}
    }else if(existing){await del('shopping',existing.id);shopping=shopping.filter(s=>s.id!==existing.id)}
  }
}

function statusLabel(s){return s==='in'?'In stock':s==='low'?'Running low':'Out'}
function statusBadge(s){return `<span class="badge ${s==='in'?'badge-ok':s==='low'?'badge-low':'badge-out'}">${statusLabel(s)}</span>`}

const ITEM_CATEGORIES=['Barang Kering','Segar','Tenusu','Sejuk Beku','Minuman','Sos & Perencah','Keperluan Rumah','Resipi','Lain-lain'];
const CATEGORY_BM={
  'Pantry':'Barang Kering','Fresh':'Segar','Dairy':'Tenusu','Frozen':'Sejuk Beku','Drinks':'Minuman','Sauces':'Sos & Perencah','Household':'Keperluan Rumah','Recipe':'Resipi','Other':'Lain-lain',
  'Barang Kering':'Barang Kering','Segar':'Segar','Tenusu':'Tenusu','Sejuk Beku':'Sejuk Beku','Minuman':'Minuman','Sos & Perencah':'Sos & Perencah','Keperluan Rumah':'Keperluan Rumah','Resipi':'Resipi','Lain-lain':'Lain-lain'
};
const RECIPE_CATEGORY_BM={'Malay Classics':'Masakan Melayu','Fish & Seafood':'Ikan & Makanan Laut','Eggs & Tofu':'Telur & Tauhu','Vegetables':'Sayur','Soups':'Sup','Rice & Noodles':'Nasi & Mi','Thai & Mamak':'Thai & Mamak','Quick Meals':'Masakan Ringkas','Pasta & Fusion':'Pasta & Fusion','Breakfast & Snacks':'Sarapan & Snek','My Recipes':'Resipi Saya'};
const categoryLabel=cat=>CATEGORY_BM[cat]||cat||'Lain-lain';
const recipeCategoryLabel=cat=>RECIPE_CATEGORY_BM[cat]||cat||'Resipi Saya';

const ITEM_ICON_CHOICES=['🛒','🛍️','🥫','🍚','🌾','🍞','🥖','🥐','🥚','🥛','🧀','🧈','🥣','🍫','🍪','🍬','🍯','🧂','🫙','🫗','🥤','🧃','☕','🍵','🧋','💧','🍗','🥩','🍖','🥓','🌭','🐟','🦐','🦀','🦑','🥥','🥔','🧅','🧄','🥕','🌽','🥦','🥬','🥒','🍅','🍆','🌶️','🫑','🫛','🍄','🍋','🍈','🍉','🍎','🍊','🍌','🍍','🥭','🍇','🍓','🫐','🥜','🫘','🫚','🌿','🍜','🍝','🍲','🍛','🍘','🧊','🧁','🍨','🧻','🧽','🧼','🧴','🧹','🗑️','🧺'];
const ITEM_ICON_RULES=[
  [/telur|egg/, '🥚'],[/susu|milk/, '🥛'],[/keju|cheese/, '🧀'],[/mentega|butter/, '🧈'],[/yogurt|yoghurt/, '🥣'],
  [/ayam|chicken/, '🍗'],[/daging|beef|meat/, '🥩'],[/kambing|lamb|mutton/, '🍖'],[/sosej|sausage|hotdog/, '🌭'],[/bacon/, '🥓'],
  [/ikan bilis|anchov/, '🐟'],[/ikan|fish|siakap|kembung|salmon|tuna|sardin/, '🐟'],[/udang|prawn|shrimp/, '🦐'],[/ketam|crab/, '🦀'],[/sotong|squid/, '🦑'],
  [/santan|kelapa|coconut/, '🥥'],[/beras|rice/, '🍚'],[/tepung|flour/, '🌾'],[/roti|bread/, '🍞'],[/mi|mee|noodle|bihun|laksa|kuey teow/, '🍜'],[/pasta|spaghetti|makaroni|macaroni/, '🍝'],
  [/kentang|potato/, '🥔'],[/halia|ginger|kunyit|turmeric/, '🫚'],[/serai|lemongrass|pandan|daun kari|curry leaf|daun sup|daun bawang|spring onion|ketumbar|coriander/, '🌿'],[/garlic|bawang putih/, '🧄'],[/bawang|onion|shallot/, '🧅'],[/lobak|carrot/, '🥕'],[/jagung|corn/, '🌽'],[/brokoli|broccoli/, '🥦'],[/sawi|kailan|kangkung|sayur|spinach|lettuce/, '🥬'],[/timun|cucumber/, '🥒'],[/tomato/, '🍅'],[/terung|eggplant/, '🍆'],[/cili|chilli|chili/, '🌶️'],[/capsicum|bell pepper/, '🫑'],[/kacang pea|peas/, '🫛'],[/cendawan|mushroom/, '🍄'],
  [/lemon|limau|lime/, '🍋'],[/tembikai|watermelon/, '🍉'],[/epal|apple/, '🍎'],[/oren|orange/, '🍊'],[/pisang|banana/, '🍌'],[/nanas|pineapple/, '🍍'],[/mangga|mango/, '🥭'],[/anggur|grape/, '🍇'],[/strawber/, '🍓'],[/blueber/, '🫐'],
  [/milo|coklat|chocolate|koko|cocoa/, '🍫'],[/biskut|biscuit|cookie/, '🍪'],[/gula|sugar/, '🍬'],[/madu|honey/, '🍯'],[/garam|salt/, '🧂'],[/kicap|sos|sauce|pes|paste|mayonnaise|mayo|jem|jam/, '🫙'],[/minyak|oil/, '🫗'],
  [/kopi|coffee/, '☕'],[/teh|tea/, '🍵'],[/jus|juice/, '🧃'],[/air mineral|mineral water|water/, '💧'],[/drink|beverage|sirap|cordial/, '🥤'],
  [/ais krim|ice cream/, '🍨'],[/frozen|sejuk beku|ice|ais/, '🧊'],[/kek|cake/, '🧁'],[/kacang|peanut|nuts/, '🥜'],[/bean|kacang merah|kacang dhal/, '🫘'],
  [/tisu|tissue|toilet paper|paper towel/, '🧻'],[/span|sponge/, '🧽'],[/sabun|soap|detergent|dishwash/, '🧼'],[/shampoo|syampu|lotion|cleaner|cecair pencuci/, '🧴'],[/penyapu|broom/, '🧹'],[/garbage|rubbish|trash|sampah/, '🗑️'],[/laundry|dobi/, '🧺']
];
function autoItemIcon(name=''){const n=basicName(name);for(const [rx,icon] of ITEM_ICON_RULES)if(rx.test(n))return icon;return'🛍️'}
function itemIcon(itemOrName){if(typeof itemOrName==='string')return autoItemIcon(itemOrName);return itemOrName?.icon||autoItemIcon(itemOrName?.name||'')}
function categoryForName(name=''){const n=basicName(name);if(/susu|milk|keju|cheese|mentega|butter|yogurt|yoghurt|telur|egg/.test(n))return'Tenusu';if(/ayam|chicken|daging|beef|ikan|fish|udang|prawn|ketam|crab|sotong|squid|sayur|bawang|garlic|tomato|kentang|potato|cili|chilli|buah|fruit|pisang|banana|epal|apple|oren|orange/.test(n))return'Segar';if(/frozen|sejuk beku|nugget|ais krim|ice cream/.test(n))return'Sejuk Beku';if(/milo|kopi|coffee|teh|tea|jus|juice|drink|air mineral|water/.test(n))return'Minuman';if(/kicap|sos|sauce|pes|paste|minyak|oil|garam|salt|gula|sugar|rempah|spice/.test(n))return'Sos & Perencah';if(/tisu|tissue|sabun|soap|detergent|garbage|sampah|sponge|span|cleaner/.test(n))return'Keperluan Rumah';return'Barang Kering'}
function itemMatch(ingredient,items){const target=normalizeName(ingredient);return items.find(i=>{const n=normalizeName(i.name);return n===target||n.includes(target)||target.includes(n)})||null}
function recipeAssessment(recipe,items){
  const details=recipe.ingredients.map(ing=>{const found=itemMatch(ing.name,items);let state='missing';if(found)state=found.status==='in'?'have':found.status==='low'?'low':'missing';const expiring=!!(found?.expiry&&daysUntil(found.expiry)>=0&&daysUntil(found.expiry)<=5);return{name:ing.name,item:found,state,expiring}});
  const have=details.filter(d=>d.state==='have').length,low=details.filter(d=>d.state==='low').length,total=details.length;
  const missing=details.filter(d=>d.state==='missing'),expiryHits=details.filter(d=>d.expiring&&d.state!=='missing').length;
  const score=Math.round(((have+low*.55)/Math.max(total,1))*100);const rank=score+(expiryHits*4)-(missing.length*1.5);
  return{details,have,low,missing,score,total,expiryHits,rank,ready:missing.length===0&&low===0};
}
async function getDemoFlag(){const d=await getOne('settings','demo');return!!d?.value}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2300)}
function closeModal(){const root=$('#modalRoot');root.innerHTML='';window.__stopScanner?.();window.__stopScanner=null}
function modal(title,body){$('#modalRoot').innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="close-btn" id="modalClose">✕</button></div>${body}</div></div>`;$('#modalClose').onclick=closeModal;$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()})}

async function render(){await syncAutoShopping();await Promise.all([renderHome(),renderShop(),renderPantry(),renderRecipes(),renderMore()])}
function switchView(name){currentView=name;$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));window.scrollTo({top:0,behavior:'smooth'})}

async function renderHome(){
  const [items,shopping,recipes]=await Promise.all([getAll('items'),getAll('shopping'),getAll('recipes')]);const demo=await getDemoFlag();
  const low=items.filter(i=>i.status==='low'),out=items.filter(i=>i.status==='out'),exp=items.filter(i=>i.expiry&&daysUntil(i.expiry)>=0&&daysUntil(i.expiry)<=7).sort((a,b)=>a.expiry.localeCompare(b.expiry));
  const predictions=await buildPredictions();const assessed=recipes.map(r=>({r,a:recipeAssessment(r,items)})).sort((x,y)=>y.a.rank-x.a.rank).slice(0,5);
  $('#view-home').innerHTML=`
    <section class="kitchen-hero">
      <div class="hero-copy"><span class="hero-kicker">YOUR KITCHEN, ONE GLANCE</span><h2>Know what to buy.<br>Know what to cook.</h2><p>DapurKu keeps the boring tracking simple, then turns your pantry into meal ideas.</p></div>
      <button class="hero-action" data-go="recipes"><span>🍳</span><b>What can I cook?</b><small>${recipes.length} recipe ideas</small></button>
    </section>
    ${demo?`<div class="demo-banner"><span>🧪</span><div><b>Demo kitchen is active</b><br>Sample pantry and history are included so every feature is visible.</div><button class="btn btn-small btn-cream" id="startBlankBtn">Start fresh</button></div>`:''}
    <section class="pulse-board">
      <button class="pulse-main" data-go="shop"><span class="pulse-label">SHOPPING</span><strong>${shopping.filter(x=>!x.checked).length}</strong><b>items to buy</b><small>Low/out items are added automatically</small></button>
      <div class="pulse-stack"><button data-go="pantry"><span>⚠️</span><b>${low.length} low</b><small>Running low</small></button><button><span>⏳</span><b>${exp.length} soon</b><small>Expiring ≤ 7 days</small></button></div>
    </section>
    <div class="section-head"><div><span class="section-kicker">QUICK ACTIONS</span><h3>Update the kitchen</h3></div></div>
    <div class="quick-orbit"><button id="qaItem"><span>🥫</span><b>Add Pantry Item</b><small>Track stock & expiry</small></button><button id="qaShop"><span>🛒</span><b>Add to Shopping</b><small>One-off item to buy</small></button><button id="qaScan"><span>▦</span><b>Scan Barcode</b><small>Open pantry form</small></button></div>
    <div class="section-head"><div><span class="section-kicker">DINNER IDEAS</span><h3>Best matches from your pantry</h3></div><button class="text-btn" data-go="recipes">Explore all →</button></div>
    <div class="recipe-strip">${assessed.map(({r,a})=>recipeTile(r,a)).join('')}</div>
    <div class="section-head"><div><span class="section-kicker">USE FIRST</span><h3>Expiring soon</h3></div></div>
    ${exp.length?`<div class="use-first">${exp.slice(0,6).map(i=>`<div class="use-card"><span>${itemIcon(i)}</span><div><b>${escapeHtml(i.name)}</b><small>${daysUntil(i.expiry)===0?'Expires today':daysUntil(i.expiry)===1?'Expires tomorrow':`${daysUntil(i.expiry)} days left`}</small></div><em>${fmtDate(i.expiry)}</em></div>`).join('')}</div>`:`<div class="empty-soft">✓ Nothing expires in the next 7 days.</div>`}
    <div class="section-head"><div><span class="section-kicker">SMART CHECK</span><h3>Likely running low</h3></div></div>
    ${predictions.length?`<div class="prediction-strip">${predictions.slice(0,4).map(p=>`<button class="prediction pred-check" data-name="${escapeHtml(p.name)}"><span>🧠</span><div><b>${escapeHtml(p.name)}</b><small>Usually every ~${p.avg} days · last bought ${p.daysSince} days ago</small></div><em>Check →</em></button>`).join('')}</div>`:`<div class="empty-soft">Prediction appears after DapurKu sees enough purchase history.</div>`}
  `;
  $$('[data-go]').forEach(x=>x.onclick=()=>switchView(x.dataset.go));$('#qaItem').onclick=()=>openItemForm();$('#qaShop').onclick=()=>openShoppingForm();$('#qaScan').onclick=()=>openScanner(async code=>{const items=await getAll('items');const found=items.find(i=>String(i.barcode||'').trim()===String(code).trim());if(found){toast(`Found ${found.name}`);openItemForm(found.id)}else{openItemForm(null,code)}});
  $$('.recipe-open').forEach(x=>x.onclick=()=>openRecipeDetail(x.dataset.id));$$('.pred-check').forEach(x=>x.onclick=()=>openPredictionCheck(x.dataset.name));if($('#startBlankBtn'))$('#startBlankBtn').onclick=confirmStartBlank;
}

function recipeTile(r,a){const label=a.ready?'Ready now':a.missing.length===0?'Use low stock':`${a.missing.length} item${a.missing.length===1?'':'s'} missing`;return `<button class="recipe-tile recipe-open" data-id="${r.id}"><div class="recipe-plate">${a.ready?'✨':a.expiryHits?'⏳':'🍽️'}</div><div class="recipe-tile-body"><small>${escapeHtml(recipeCategoryLabel(r.category))}</small><b>${escapeHtml(recipeTitleLabel(r))}</b><div class="match-line"><span style="width:${a.score}%"></span></div><em>${a.score}% match · ${label}</em></div></button>`}

async function renderShop(){
  const [shoppingRaw,history,pantryItems]=await Promise.all([getAll('shopping'),getAll('history'),getAll('items')]);const shopping=shoppingRaw.sort((a,b)=>Number(a.checked)-Number(b.checked)||(a.category||'').localeCompare(b.category||''));const groups={};shopping.forEach(s=>(groups[categoryLabel(s.category||'Lain-lain')]??=[]).push({...s,category:categoryLabel(s.category||'Lain-lain')}));const pending=shopping.filter(x=>!x.checked).length;
  $('#view-shop').innerHTML=`
    <div class="page-intro"><span class="page-icon">🛒</span><div><span class="section-kicker">SHOPPING</span><h2>${shoppingMode?'Shopping mode':'Your shopping list'}</h2><p>${shoppingMode?'Tick items as they go into the trolley. Finish to restock your pantry.':`${pending} item${pending===1?'':'s'} still to buy.`}</p></div></div>
    <div class="shop-actions">${shoppingMode?`<button class="btn btn-danger-soft" id="cancelShopBtn">✕ Cancel</button><button class="btn btn-primary" id="finishShopBtn">✓ Finish Shopping</button>`:`<button class="btn btn-secondary" id="addShopBtn">+ Add to Shopping List</button><button class="btn btn-primary" id="startShopBtn" ${shopping.length?'':'disabled'}>Start Shopping →</button>`}</div>
    ${shoppingMode?`<div class="shopping-banner"><span>🛍️</span><div><b>${shopping.filter(x=>x.checked).length} picked</b><small>${shopping.filter(x=>!x.checked).length} remaining</small></div><div class="shopping-progress"><i style="width:${shopping.length?Math.round(shopping.filter(x=>x.checked).length/shopping.length*100):0}%"></i></div></div>`:''}
    <div class="${shoppingMode?'shopping-mode':''}">${shopping.length?Object.entries(groups).map(([cat,arr])=>`<section class="shop-group"><h4>${escapeHtml(cat)}</h4>${arr.map(s=>`<div class="shop-item ${s.checked?'done':''}"><input class="shop-check" data-id="${s.id}" type="checkbox" ${s.checked?'checked':''}><span class="shop-item-icon">${itemIcon(s.itemId?pantryItems.find(i=>i.id===s.itemId)||s:s)}</span><div class="row-main"><div class="row-title">${escapeHtml(s.name)} ${s.qty&&s.qty!==1?`×${s.qty}`:''}</div><div class="row-sub">${s.source==='auto'?(s.reason==='out'?'Auto · Out of stock':'Auto · Running low'):s.source==='recipe'?'From recipe':'Manual'}${s.unit?` · ${escapeHtml(s.unit)}`:''} · ${(()=>{const p=s.lastPurchasedAt||itemMatch(s.name,pantryItems)?.lastPurchasedAt||latestPurchaseFor(s.name,history);return p?`Last bought ${fmtDate(p)}`:'No purchase date yet'})()}</div></div>${!shoppingMode?`<button class="mini-btn shop-delete" data-id="${s.id}" aria-label="Delete item from shopping list" title="Delete">🗑️</button>`:''}</div>`).join('')}</section>`).join(''):`<div class="empty"><div class="big">🛒</div><b>Your list is empty.</b><br>Pantry items marked <b>Running low</b> or <b>Out</b> appear here automatically.</div>`}</div>`;
  $$('.shop-check').forEach(c=>c.onchange=async()=>{const s=await getOne('shopping',c.dataset.id);s.checked=c.checked;await put('shopping',s);renderShop()});
  $$('.shop-delete').forEach(b=>b.onclick=async()=>{
    const s=await getOne('shopping',b.dataset.id);if(!s)return;
    if(!confirm(`Delete ${s.name} from the shopping list?`))return;
    if(s.source==='auto'&&s.itemId){
      const item=await getOne('items',s.itemId);
      if(item){item.autoShoppingDismissedStatus=item.status;item.updatedAt=todayISO();await put('items',item)}
    }
    await del('shopping',b.dataset.id);
    toast(s.source==='auto'?'Removed from this shopping cycle':'Removed from shopping list');
    render();
  });
  if($('#addShopBtn'))$('#addShopBtn').onclick=()=>openShoppingForm();if($('#startShopBtn'))$('#startShopBtn').onclick=startShopping;if($('#finishShopBtn'))$('#finishShopBtn').onclick=openFinishShopping;if($('#cancelShopBtn'))$('#cancelShopBtn').onclick=cancelShopping;
}

async function startShopping(){const all=await getAll('shopping');shoppingSnapshot=Object.fromEntries(all.map(s=>[s.id,!!s.checked]));shoppingMode=true;toast('Shopping mode started');renderShop()}
async function cancelShopping(){if(!confirm('Cancel this shopping session? Any ticks made after starting will be restored to their previous state.'))return;const all=await getAll('shopping');if(shoppingSnapshot){for(const s of all){if(Object.prototype.hasOwnProperty.call(shoppingSnapshot,s.id)){s.checked=shoppingSnapshot[s.id];await put('shopping',s)}}}shoppingMode=false;shoppingSnapshot=null;toast('Shopping session cancelled');renderShop()}

async function renderPantry(){
  const items=(await getAll('items')).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.name.localeCompare(b.name));
  $('#view-pantry').innerHTML=`<div class="page-intro"><span class="page-icon">🥫</span><div><span class="section-kicker">PANTRY</span><h2>What you have at home</h2><p>Item icons make the list faster to scan. Keep stock simple: In → Low → Out.</p></div></div>
    <div class="toolbar"><input id="pantrySearch" placeholder="Search pantry..."><select id="pantryCategory"><option value="">All categories</option>${ITEM_CATEGORIES.filter(x=>x!=='Resipi').map(x=>`<option>${x}</option>`).join('')}</select></div>
    <div id="pantryList"></div><button class="fab" id="addPantryFab" aria-label="Add pantry item">＋</button>`;
  const draw=()=>{const q=normalizeName($('#pantrySearch').value),cat=$('#pantryCategory').value;const list=items.filter(i=>(!q||normalizeName(i.name).includes(q))&&(!cat||categoryLabel(i.category)===cat));$('#pantryList').innerHTML=list.length?`<div class="pantry-grid">${list.map(i=>`<article class="pantry-card"><button class="pantry-edit" data-id="${i.id}"><span class="pantry-icon">${itemIcon(i)}</span><div><b>${escapeHtml(i.name)}</b><small>${escapeHtml(categoryLabel(i.category))}${i.expiry?` · Exp ${fmtDate(i.expiry)}`:''}${i.lastPurchasedAt?` · Bought ${fmtDate(i.lastPurchasedAt)}`:''}</small></div>${i.favorite?'<em>★</em>':''}</button><div class="status-switch">${['in','low','out'].map(s=>`<button class="status-set ${i.status===s?'active '+s:''}" data-id="${i.id}" data-status="${s}">${s==='in'?'In':s==='low'?'Low':'Out'}</button>`).join('')}</div></article>`).join('')}</div>`:'<div class="empty">No pantry items found.</div>';$$('.pantry-edit').forEach(b=>b.onclick=()=>openItemForm(b.dataset.id));$$('.status-set').forEach(b=>b.onclick=async()=>{const i=await getOne('items',b.dataset.id);const previous=i.status;i.status=b.dataset.status;if(previous!==i.status)delete i.autoShoppingDismissedStatus;i.updatedAt=todayISO();await put('items',i);await syncAutoShopping();toast(`${i.name}: ${statusLabel(i.status)}`);render()})};
  $('#pantrySearch').addEventListener('input',draw);$('#pantryCategory').addEventListener('change',draw);$('#addPantryFab').onclick=()=>openItemForm();draw();
}

async function renderRecipes(){
  const [recipes,items]=await Promise.all([getAll('recipes'),getAll('items')]);const cats=[...new Set(recipes.map(r=>r.category))].sort((a,b)=>recipeCategoryLabel(a).localeCompare(recipeCategoryLabel(b)));const assessments=recipes.map(r=>({r,a:recipeAssessment(r,items)}));
  const ready=assessments.filter(x=>x.a.ready).length,almost=assessments.filter(x=>x.a.missing.length<=2&&!x.a.ready).length;
  $('#view-recipes').innerHTML=`<div class="page-intro recipe-intro"><span class="page-icon">🍳</span><div><span class="section-kicker">RECIPE DISCOVERY</span><h2>What should I cook?</h2><p>DapurKu ranks meals using what is already in your kitchen.</p></div></div>
    <div class="recipe-summary"><div><strong>${ready}</strong><span>Ready now</span></div><div><strong>${almost}</strong><span>1–2 items away</span></div><div><strong>${recipes.length}</strong><span>Ideas</span></div></div>
    <div class="recipe-cta"><div><b>Feeling blank?</b><small>Let DapurKu pick one of your best pantry matches.</small></div><button class="btn btn-primary" id="surpriseRecipe">Pick for me ✦</button></div>
    <div class="recipe-tools"><input id="recipeSearch" placeholder="Search dish or ingredient..."><select id="recipeCategory"><option value="">All categories</option>${cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(recipeCategoryLabel(c))}</option>`).join('')}</select><select id="recipeSort"><option value="best">Best pantry match</option><option value="ready">Ready now first</option><option value="expiry">Use expiring food</option><option value="quick">Quickest first</option></select></div>
    <div class="recipe-library-head"><span id="recipeCount"></span><button class="text-btn" id="addRecipeBtn">+ Add your recipe</button></div><div id="recipeList"></div>`;
  const draw=()=>{const q=normalizeName($('#recipeSearch').value),cat=$('#recipeCategory').value,sort=$('#recipeSort').value;let list=assessments.filter(({r})=>(!q||normalizeName(recipeTitleLabel(r)).includes(q)||r.ingredients.some(i=>normalizeName(recipeIngredientLabel(i.name)).includes(q)||normalizeName(i.name).includes(q)))&&(!cat||r.category===cat));
    if(sort==='ready')list.sort((x,y)=>Number(y.a.ready)-Number(x.a.ready)||y.a.rank-x.a.rank);else if(sort==='expiry')list.sort((x,y)=>y.a.expiryHits-x.a.expiryHits||y.a.rank-x.a.rank);else if(sort==='quick')list.sort((x,y)=>(x.r.time||999)-(y.r.time||999));else list.sort((x,y)=>y.a.rank-x.a.rank||recipeTitleLabel(x.r).localeCompare(recipeTitleLabel(y.r)));
    $('#recipeCount').textContent=`${list.length} recipe${list.length===1?'':'s'}`;$('#recipeList').innerHTML=list.length?`<div class="recipe-list">${list.map(({r,a})=>`<button class="recipe-row recipe-open" data-id="${r.id}"><div class="recipe-row-score"><strong>${a.score}</strong><small>% match</small></div><div class="recipe-row-main"><span>${escapeHtml(recipeCategoryLabel(r.category))} · ${r.time||'-'} min</span><b>${escapeHtml(recipeTitleLabel(r))}</b><div class="chips">${a.ready?'<i class="chip ready">Ready now</i>':a.missing.length?`<i class="chip missing">${a.missing.length} missing</i>`:'<i class="chip low">Low stock</i>'}${a.expiryHits?`<i class="chip expiry">Uses ${a.expiryHits} expiring item${a.expiryHits>1?'s':''}</i>`:''}${r.sourceName==='Che Nom'?'<i class="chip source">Che Nom source</i>':''}</div></div><span class="recipe-arrow">›</span></button>`).join('')}</div>`:'<div class="empty">No recipes match your search.</div>';$$('.recipe-open').forEach(x=>x.onclick=()=>openRecipeDetail(x.dataset.id))};
  $('#recipeSearch').addEventListener('input',draw);$('#recipeCategory').addEventListener('change',draw);$('#recipeSort').addEventListener('change',draw);$('#addRecipeBtn').onclick=openRecipeForm;$('#surpriseRecipe').onclick=()=>{const top=assessments.sort((x,y)=>y.a.rank-x.a.rank).slice(0,Math.min(10,assessments.length));if(top.length)openRecipeDetail(top[Math.floor(Math.random()*top.length)].r.id)};draw();
}

async function renderMore(){
  const history=(await getAll('history')).sort((a,b)=>b.date.localeCompare(a.date));const theme=getTheme();const members=cloudMembers||[];
  const syncHtml=!cloudConfigured?`<div class="sync-card"><div class="sync-state"><span class="sync-dot local"></span><div><b>Cloud sync not configured</b><small>App is working locally. Complete Supabase setup when you are ready to share the kitchen.</small></div></div><div class="note">Use <b>SETUP_SUPABASE.sql</b>, then paste your Project URL and Publishable key into <b>config.js</b>.</div></div>`
  :!cloudUser?`<div class="sync-card"><div class="sync-state"><span class="sync-dot"></span><div><b>Sign in to sync your kitchen</b><small>Use the same shared kitchen from another phone with a different email account.</small></div></div><div class="settings-row"><button class="btn btn-secondary" id="signInBtn">Sign In</button><button class="btn btn-primary" id="signUpBtn">Create Account</button></div></div>`
  :`<div class="sync-card"><div class="sync-state"><span class="sync-dot ${navigator.onLine?'ok':'warn'}"></span><div><b>${escapeHtml(cloudStatus)}</b><small>${escapeHtml(cloudUser.email||'')} · ${escapeHtml(activeHouseholdName())}</small></div></div>${cloudHouseholds.length>1?`<div class="field"><label>Kitchen</label><select id="householdSelect">${cloudHouseholds.map(h=>`<option value="${h.id}" ${activeHousehold?.id===h.id?'selected':''}>${escapeHtml(h.name)}${h.owner_id===cloudUser.id?' · Mine':' · Shared'}</option>`).join('')}</select></div>`:''}<div class="settings-row"><button class="btn btn-secondary" id="syncNowBtn">↻ Sync Now</button><button class="btn btn-secondary" id="signOutBtn">Sign Out</button></div>${activeHousehold?.owner_id===cloudUser.id?`<div class="share-box"><b>Share this kitchen</b><small>Add the email your partner will use to sign in to DapurKu.</small><div class="share-line"><input id="shareEmail" type="email" placeholder="partner@email.com"><button class="btn btn-primary" id="shareEmailBtn">Add Email</button></div></div>`:''}<div class="member-list">${members.map(m=>`<div><span>${m.user_id?'✓':'○'}</span><b>${escapeHtml(m.email)}</b><small>${m.role==='owner'?'Owner':m.user_id?'Connected':'Waiting for sign-in'}</small></div>`).join('')}</div><div class="note">Changes to pantry, shopping list, purchase history and your own recipes sync between connected members. Built-in recipes and theme stay on each device.</div></div>`;
  $('#view-more').innerHTML=`<div class="page-intro"><span class="page-icon">⋯</span><div><span class="section-kicker">MORE</span><h2>Kitchen settings</h2><p>Theme, family sync, purchase history and backup.</p></div></div>
    <div class="section-head"><div><h3>Appearance</h3></div></div><div class="theme-card"><div><b>${theme==='dark'?'Dark Mode':'Light Mode'}</b><small>Your theme is remembered on this device.</small></div><button class="theme-switch ${theme==='dark'?'on':''}" id="themeToggle" aria-label="Toggle theme"><i></i></button></div>
    <div class="section-head"><div><h3>Family Sync</h3><p>Share one live kitchen using separate email accounts.</p></div></div>${syncHtml}
    <div class="section-head"><div><h3>Purchase History</h3><p>Keep More tidy — open history only when you need it.</p></div></div>${history.length?`<button class="history-hub" id="manageHistoryBtn"><span class="history-hub-icon">🧾</span><div><b>${history.length} purchase${history.length===1?'':'s'} recorded</b><small>Latest · ${fmtDate(history[0].date)}${history[0].store?` · ${escapeHtml(history[0].store)}`:''}</small></div><em>View & delete ›</em></button>`:'<div class="empty-soft">No purchase history yet.</div>'}
    <div class="section-head"><div><h3>Backup</h3><p>Useful before changing phone or clearing browser data.</p></div></div><div class="settings-row"><button class="btn btn-secondary" id="exportBtn">Export Backup</button><label class="btn btn-secondary file-btn">Import Backup<input type="file" id="importFile" accept="application/json"></label></div>
    <div class="section-head"><div><h3>About</h3></div></div><div class="note">DapurKu v3.4 · Offline-first PWA · Light/Dark · Family Sync · auto purchase dates · smart shopping · expiry · history · prediction · pantry-based recipe discovery.</div>
    <div class="danger-zone"><b>Reset local data</b><p>This deletes the local copy on this device. If Family Sync is active, cloud data can download again on the next sync.</p><button class="btn btn-danger-soft" id="resetBtn">Reset Local DapurKu</button></div>`;
  $('#themeToggle').onclick=()=>{toggleTheme();renderMore()};$('#exportBtn').onclick=exportData;$('#importFile').onchange=importData;$('#resetBtn').onclick=confirmReset;if($('#manageHistoryBtn'))$('#manageHistoryBtn').onclick=openHistoryManager;
  if($('#signInBtn'))$('#signInBtn').onclick=()=>openAuthModal('signin');if($('#signUpBtn'))$('#signUpBtn').onclick=()=>openAuthModal('signup');if($('#signOutBtn'))$('#signOutBtn').onclick=async()=>{await cloudSignOut();toast('Signed out. Local data stays on this device.');render()};
  if($('#syncNowBtn'))$('#syncNowBtn').onclick=async()=>{try{await resumeCloudSync(true);cloudMembers=await getCloudMembers();toast('Kitchen synced')}catch(e){toast('Sync failed: '+e.message)}};
  if($('#householdSelect'))$('#householdSelect').onchange=async e=>{try{await switchCloudHousehold(e.target.value)}catch(err){alert('Could not switch kitchen: '+err.message)}};
  if($('#shareEmailBtn'))$('#shareEmailBtn').onclick=async()=>{const email=$('#shareEmail').value.trim();if(!email)return toast('Enter an email first');try{await inviteSyncEmail(email);toast(`Kitchen access added for ${email}`);renderMore()}catch(err){alert('Could not add email: '+err.message)}};
}

async function openHistoryManager(){
  const history=(await getAll('history')).sort((a,b)=>b.date.localeCompare(a.date));
  const body=history.length?`<div class="history-manager-head"><div><b>${history.length} purchase${history.length===1?'':'s'}</b><small>Deleting history also removes it from Family Sync and Smart Prediction.</small></div><button class="btn btn-danger-soft btn-small" id="clearHistoryBtn">Clear All</button></div><div class="history-manager-list">${history.map(h=>`<div class="history-manage-row"><div class="history-manage-main"><div class="history-head"><b>${fmtDate(h.date)}</b><strong>${h.total?`RM ${Number(h.total).toFixed(2)}`:'—'}</strong></div><small>${escapeHtml(h.store||'Store not recorded')}</small><div class="history-items">${(h.items||[]).map(i=>escapeHtml(i.name)+(i.qty&&i.qty!==1?` ×${i.qty}`:'')).join(' · ')}</div></div><button class="history-delete-btn" data-id="${h.id}" aria-label="Delete purchase history" title="Delete">🗑️</button></div>`).join('')}</div>`:`<div class="empty-soft">No purchase history yet.</div>`;
  modal('Purchase History',body);
  $$('.history-delete-btn').forEach(b=>b.onclick=async()=>{
    const h=await getOne('history',b.dataset.id);if(!h)return;
    if(!confirm(`Delete purchase history from ${fmtDate(h.date)}?`))return;
    await del('history',b.dataset.id);toast('Purchase history deleted');closeModal();render();
  });
  if($('#clearHistoryBtn'))$('#clearHistoryBtn').onclick=async()=>{
    if(!confirm(`Delete all ${history.length} purchase history records? Pantry items and shopping list will stay.`))return;
    for(const h of history)await del('history',h.id);setTimeout(()=>flushSyncQueue().catch(()=>{}),250);
    toast('Purchase history cleared');closeModal();render();
  };
}

function openAuthModal(mode='signin'){
  const signup=mode==='signup';modal(signup?'Create DapurKu Account':'Sign In',`<form id="authForm"><div class="note">${signup?'Create your own email login. If someone already shared a kitchen with this email, DapurKu will connect it after sign-in.':'Sign in to load kitchens shared with this email.'}</div><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Password</label><input name="password" type="password" minlength="6" autocomplete="${signup?'new-password':'current-password'}" required></div><div class="form-actions"><button class="btn btn-primary" type="submit">${signup?'Create Account':'Sign In'}</button></div></form>`);$('#authForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),email=f.get('email').trim(),password=f.get('password');const btn=e.target.querySelector('button');btn.disabled=true;btn.textContent='Please wait…';try{if(signup){const data=await cloudSignUp(email,password);closeModal();if(data?.session){toast('Account created and signed in')}else alert('Account created. Check your email to confirm the account, then return to DapurKu and Sign In.')}else{await cloudSignIn(email,password);closeModal();toast('Signed in')} }catch(err){alert(err.message)}finally{btn.disabled=false}};
}

function openItemForm(id=null,prefillBarcode=''){
  Promise.resolve(id?getOne('items',id):null).then(item=>{item=item||{name:'',category:'Barang Kering',status:'in',favorite:false,expiry:'',barcode:prefillBarcode,qty:1,unit:'',icon:''};
    item.category=categoryLabel(item.category);
    const currentIcon=item.icon||autoItemIcon(item.name);
    modal(id?'Edit Pantry Item':'Add Pantry Item',`<form id="itemForm"><div class="form-grid"><div class="field full"><label>Item name</label><input id="itemNameInput" name="name" required value="${escapeHtml(item.name)}" placeholder="e.g. Milo / Telur / Ayam"></div><div class="field full"><label>Item icon</label><input type="hidden" name="icon" id="itemIconInput" value="${escapeHtml(currentIcon)}"><div class="icon-picker-head"><span class="selected-item-icon" id="selectedItemIcon">${currentIcon}</span><div><b id="iconHint">Auto picked from item name</b><small>Tap another icon if you prefer.</small></div></div><div class="item-icon-picker">${ITEM_ICON_CHOICES.map(ic=>`<button type="button" class="item-icon-choice ${ic===currentIcon?'active':''}" data-icon="${ic}">${ic}</button>`).join('')}</div></div><div class="field"><label>Category</label><select name="category" id="itemCategorySelect">${ITEM_CATEGORIES.filter(x=>x!=='Resipi').map(x=>`<option ${item.category===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Stock status</label><select name="status"><option value="in" ${item.status==='in'?'selected':''}>In stock</option><option value="low" ${item.status==='low'?'selected':''}>Running low</option><option value="out" ${item.status==='out'?'selected':''}>Out</option></select></div><div class="field"><label>Quantity (optional)</label><input name="qty" type="number" min="0" step="any" value="${item.qty??1}"></div><div class="field"><label>Unit</label><input name="unit" value="${escapeHtml(item.unit||'')}" placeholder="pack / bottle / pcs"></div><div class="field"><label>Expiry date (optional)</label><input name="expiry" type="date" value="${item.expiry||''}"></div><div class="field"><label>Purchase date (optional)</label><input name="purchaseDate" type="date" value="${item.lastPurchasedAt||''}"></div><div class="field full"><label>Barcode (optional)</label><input name="barcode" value="${escapeHtml(item.barcode||'')}"></div><label class="check-row full"><input type="checkbox" name="favorite" ${item.favorite?'checked':''}> Always keep this stocked</label></div><div class="form-actions">${id?'<button class="btn btn-danger-soft" type="button" id="deleteItemBtn">Delete</button>':''}<button class="btn btn-primary" type="submit">Save Item</button></div></form>`);
    let iconManuallyPicked=!!item.icon;
    const setIcon=ic=>{$('#itemIconInput').value=ic;$('#selectedItemIcon').textContent=ic;$$('.item-icon-choice').forEach(b=>b.classList.toggle('active',b.dataset.icon===ic))};
    $$('.item-icon-choice').forEach(b=>b.onclick=()=>{iconManuallyPicked=true;setIcon(b.dataset.icon);$('#iconHint').textContent='Custom icon selected'});
    $('#itemNameInput').addEventListener('input',e=>{if(!iconManuallyPicked){setIcon(autoItemIcon(e.target.value));$('#iconHint').textContent='Auto picked from item name'}if(!id){const suggested=categoryForName(e.target.value);$('#itemCategorySelect').value=suggested}});
    $('#itemForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const nextStatus=f.get('status');const val={...item,id:id||uid(),name:f.get('name').trim(),icon:f.get('icon')||autoItemIcon(f.get('name')),category:f.get('category'),status:nextStatus,qty:Number(f.get('qty')||0),unit:f.get('unit').trim(),expiry:f.get('expiry'),barcode:f.get('barcode').trim(),favorite:f.get('favorite')==='on',lastPurchasedAt:f.get('purchaseDate')||item.lastPurchasedAt||'',createdAt:item.createdAt||todayISO(),updatedAt:todayISO()};if(item.status!==nextStatus)delete val.autoShoppingDismissedStatus;delete val.location;await put('items',val);await syncAutoShopping();closeModal();toast(id?'Pantry item updated':'Pantry item added');render()};
    if(id)$('#deleteItemBtn').onclick=async()=>{if(confirm(`Delete ${item.name}?`)){await del('items',id);const shopping=await getAll('shopping');for(const s of shopping.filter(x=>x.itemId===id))await del('shopping',s.id);closeModal();render()}};
  });
}

function openShoppingForm(prefill=''){
  const initialCategory=categoryForName(prefill);
  modal('Add to Shopping List',`<div class="note"><b>Shopping-only item:</b> use this for something you want to buy without maintaining stock/expiry. Use <b>Add Pantry Item</b> if you want DapurKu to track it at home.</div><form id="shopForm"><div class="form-grid"><div class="field full"><label>Item</label><div class="shop-name-with-icon"><span id="shopIconPreview">${autoItemIcon(prefill)}</span><input id="shopNameInput" name="name" required value="${escapeHtml(prefill)}" placeholder="e.g. Kitchen towel / Milo"></div></div><div class="field"><label>Category</label><select name="category" id="shopCategorySelect">${ITEM_CATEGORIES.map(x=>`<option ${initialCategory===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Quantity</label><input name="qty" type="number" min="1" value="1"></div><div class="field full"><label>Last bought (optional · first setup only)</label><input name="purchaseDate" type="date"><small>DapurKu will record this automatically after you use Finish Shopping next time.</small></div></div><div class="form-actions"><button class="btn btn-primary" type="submit">Add to List</button></div></form>`);
  $('#shopNameInput').addEventListener('input',e=>{$('#shopIconPreview').textContent=autoItemIcon(e.target.value);$('#shopCategorySelect').value=categoryForName(e.target.value)});
  $('#shopForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const name=f.get('name').trim();await put('shopping',{id:uid(),name,icon:autoItemIcon(name),category:f.get('category'),qty:Number(f.get('qty')||1),checked:false,source:'manual',lastPurchasedAt:f.get('purchaseDate')||'',createdAt:new Date().toISOString()});closeModal();toast('Added to shopping list');render()};
}

async function openFinishShopping(){
  const all=await getAll('shopping'),checked=all.filter(x=>x.checked);if(!checked.length){toast('Tick at least one purchased item first');return}
  modal('Finish Shopping',`<form id="finishForm"><div class="field"><label>Purchase date</label><input name="purchaseDate" type="date" value="${todayISO()}" required></div><div class="field"><label>Store (optional)</label><input name="store" placeholder="Lotus / NSK / AEON"></div><div class="field"><label>Total spent RM (optional)</label><input name="total" type="number" min="0" step="0.01" placeholder="0.00"></div><div class="note">${checked.length} purchased item${checked.length===1?'':'s'} will be recorded in Purchase History and restocked as <b>In stock</b>.</div><div class="form-actions"><button class="btn btn-primary" type="submit">Finish & Restock</button></div></form>`);
  $('#finishForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),purchaseDate=f.get('purchaseDate')||todayISO(),items=await getAll('items'),histItems=[];for(const s of checked){let item=s.itemId?items.find(i=>i.id===s.itemId):itemMatch(s.name,items);if(item){item.status='in';delete item.autoShoppingDismissedStatus;item.updatedAt=todayISO();item.lastPurchasedAt=purchaseDate;await put('items',item)}else if(s.source==='recipe'){item={id:uid(),name:s.name,icon:s.icon||autoItemIcon(s.name),category:categoryLabel(s.category||'Lain-lain'),status:'in',favorite:false,expiry:'',barcode:'',qty:s.qty||1,unit:'',createdAt:todayISO(),updatedAt:todayISO(),lastPurchasedAt:purchaseDate};await put('items',item)}histItems.push({name:s.name,qty:s.qty||1});await del('shopping',s.id)}await put('history',{id:uid(),date:purchaseDate,store:f.get('store').trim(),total:Number(f.get('total')||0),items:histItems});shoppingMode=false;shoppingSnapshot=null;closeModal();await syncAutoShopping();toast(`Shopping saved · ${fmtDate(purchaseDate)}`);render()};
}

async function openRecipeDetail(id){
  const [r,items]=await Promise.all([getOne('recipes',id),getAll('items')]);if(!r)return;const a=recipeAssessment(r,items);
  modal(escapeHtml(recipeTitleLabel(r)),`<div class="recipe-detail-head"><div><span>${escapeHtml(recipeCategoryLabel(r.category))} · ${r.time||'-'} min</span><strong>${a.score}% pantry match</strong></div>${a.ready?'<b class="ready-pill">Ready to cook</b>':`<b class="need-pill">${a.missing.length} missing</b>`}</div><div class="match-line large"><span style="width:${a.score}%"></span></div><div class="note">${escapeHtml(recipeNoteLabel(r))}</div><div class="ingredient-list">${a.details.map(d=>`<div class="ingredient ${d.state}"><span class="ingredient-icon">${autoItemIcon(recipeIngredientLabel(d.name))}</span><div class="row-main"><b>${escapeHtml(recipeIngredientLabel(d.name))}</b><div class="row-sub">${d.state==='have'?'In your pantry':d.state==='low'?'You have it, but stock is low':'Missing / out of stock'}${d.expiring?' · use soon':''}</div></div>${d.state==='have'?'<span class="badge badge-ok">Have</span>':d.state==='low'?'<span class="badge badge-low">Low</span>':'<span class="badge badge-out">Buy</span>'}</div>`).join('')}</div>
    ${a.missing.length||a.low?`<button class="btn btn-primary btn-block" id="addMissingBtn">🛒 Add missing / low ingredients</button>`:'<div class="empty-soft">✨ You already have the main ingredients.</div>'}
    ${r.sourceUrl?`<a class="btn btn-secondary btn-block source-link" href="${r.sourceUrl}" target="_blank" rel="noopener">Open ${escapeHtml(r.sourceName||'source')} recipe ↗</a>`:''}`);
  if($('#addMissingBtn'))$('#addMissingBtn').onclick=async()=>{const existing=await getAll('shopping');for(const d of a.details.filter(x=>x.state!=='have')){if(!existing.find(s=>normalizeName(s.name)===normalizeName(d.name)&&!s.checked))await put('shopping',{id:uid(),name:recipeIngredientLabel(d.name),category:'Resipi',icon:autoItemIcon(recipeIngredientLabel(d.name)),qty:1,checked:false,source:'recipe',createdAt:new Date().toISOString()})}closeModal();toast('Ingredients added to shopping list');render()};
}

function openRecipeForm(){
  modal('Add Your Recipe',`<form id="recipeForm"><div class="field"><label>Recipe name</label><input name="title" required placeholder="e.g. Mum’s ikan sambal"></div><div class="field"><label>Category</label><input name="category" value="Resipi Saya"></div><div class="field"><label>Time (minutes)</label><input type="number" name="time" value="30"></div><div class="field"><label>Ingredients — one per line</label><textarea name="ingredients" required placeholder="ikan\ncili kering\nbawang merah\ngaram"></textarea></div><div class="field"><label>Source URL (optional)</label><input type="url" name="sourceUrl" placeholder="https://..."></div><div class="form-actions"><button class="btn btn-primary" type="submit">Save Recipe</button></div></form>`);
  $('#recipeForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),ingredients=f.get('ingredients').split(/\n|,/).map(s=>s.trim()).filter(Boolean).map(name=>({name}));await put('recipes',{id:uid(),title:f.get('title').trim(),category:f.get('category').trim()||'Resipi Saya',time:Number(f.get('time')||0),sourceName:f.get('sourceUrl')?'External source':'DapurKu',sourceUrl:f.get('sourceUrl').trim(),note:'Resipi anda sendiri.',ingredients});closeModal();toast('Recipe saved');render()};
}

async function buildPredictions(){const [history,items]=await Promise.all([getAll('history'),getAll('items')]);const by={};history.sort((a,b)=>a.date.localeCompare(b.date)).forEach(h=>h.items.forEach(it=>{const key=normalizeName(it.name);(by[key]??={name:it.name,dates:[]}).dates.push(h.date)}));const out=[];for(const k of Object.keys(by)){const d=by[k].dates;if(d.length<2)continue;const ints=[];for(let i=1;i<d.length;i++)ints.push(daysBetween(d[i-1],d[i]));const avg=Math.round(ints.reduce((a,b)=>a+b,0)/ints.length),last=d[d.length-1],ds=daysBetween(last,todayISO()),item=itemMatch(by[k].name,items);if(avg>0&&ds>=Math.max(3,Math.floor(avg*.78))&&(!item||item.status==='in'))out.push({name:by[k].name,avg,daysSince:ds,ratio:ds/avg})}return out.sort((a,b)=>b.ratio-a.ratio)}
async function openPredictionCheck(name){const items=await getAll('items'),item=itemMatch(name,items);modal(`Check ${escapeHtml(name)}`,`<div class="note">This prediction is only a reminder. DapurKu never changes stock automatically.</div><div class="prediction-choices"><button class="btn btn-secondary pred-set" data-status="in">✓ Still in stock</button><button class="btn btn-secondary pred-set" data-status="low">⚠ Running low</button><button class="btn btn-danger-soft pred-set" data-status="out">Out</button></div>`);$$('.pred-set').forEach(b=>b.onclick=async()=>{let target=item;if(!target)target={id:uid(),name,icon:autoItemIcon(name),category:categoryForName(name),favorite:false,expiry:'',barcode:'',qty:1,unit:'',createdAt:todayISO()};target.status=b.dataset.status;delete target.autoShoppingDismissedStatus;target.updatedAt=todayISO();await put('items',target);await syncAutoShopping();closeModal();toast(`${name}: ${statusLabel(target.status)}`);render()})}

function openScanner(onFound){modal('Scan Barcode',`<div class="scanner-wrap"><video id="scannerVideo" playsinline muted></video><div class="scanner-status" id="scannerStatus">Requesting camera access...</div></div><div class="note">If your browser does not support barcode detection, enter the barcode manually in Add Pantry Item. No external scanner library is loaded, so the PWA remains offline-friendly.</div>`);const video=$('#scannerVideo'),status=$('#scannerStatus');let stream=null,stopped=false;const stop=()=>{stopped=true;if(stream)stream.getTracks().forEach(t=>t.stop())};window.__stopScanner=stop;(async()=>{if(!('BarcodeDetector'in window)){status.textContent='BarcodeDetector is not supported in this browser. Use manual barcode entry.';return}try{const formats=await BarcodeDetector.getSupportedFormats(),detector=new BarcodeDetector({formats:formats.filter(f=>['ean_13','ean_8','upc_a','upc_e','code_128'].includes(f))});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();status.textContent='Point the camera at a barcode...';const tick=async()=>{if(stopped)return;try{const codes=await detector.detect(video);if(codes.length){const code=codes[0].rawValue;stop();closeModal();onFound?.(code);return}}catch{}requestAnimationFrame(tick)};tick()}catch(err){status.textContent='Could not open camera: '+err.message}})()}

async function exportData(){const data={version:'3.4',exportedAt:new Date().toISOString()};for(const s of STORE_NAMES)data[s]=await getAll(s);const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`DapurKu-backup-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup exported')}
async function importData(e){const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());for(const s of STORE_NAMES){if(Array.isArray(data[s])){await clearStore(s);for(const x of data[s])await put(s,x)}}await put('settings',{id:'initialized',value:true});await ensureRecipeLibrary();toast('Backup imported');render()}catch(err){alert('Import failed: '+err.message)}e.target.value=''}
async function confirmReset(){if(!confirm('Delete ALL DapurKu data stored on this device?'))return;for(const s of STORE_NAMES)await clearStore(s);await put('settings',{id:'initialized',value:true});await put('settings',{id:'demo',value:false});await ensureRecipeLibrary();toast('Local data cleared. Built-in recipe library restored.');render()}
async function confirmStartBlank(){if(!confirm('Remove the demo pantry and purchase history? The recipe library will stay.'))return;for(const s of ['items','shopping','history'])await clearStore(s);await put('settings',{id:'demo',value:false});toast('Demo data removed. Your kitchen is ready.');render()}
function wireNav(){$$('.nav-btn').forEach(b=>b.onclick=()=>switchView(b.dataset.view));if($('#themeBtn'))$('#themeBtn').onclick=toggleTheme}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')};window.addEventListener('appinstalled',()=>toast('DapurKu installed'));
(async function init(){try{applyTheme(getTheme());await openDB();await seedIfNeeded();wireNav();await initCloudSync();await render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=3.4').catch(()=>{})}catch(err){document.body.innerHTML=`<pre style="padding:20px">DapurKu could not start:\n${escapeHtml(err.stack||err.message)}</pre>`}})();
