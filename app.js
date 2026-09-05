const DB_NAME='DapurKuDB';
const DB_VERSION=1;
const STORE_NAMES=['items','shopping','history','recipes','settings'];
let db;
let currentView='home';
let deferredPrompt=null;
let shoppingMode=false;

const $=sel=>document.querySelector(sel);
const $$=sel=>[...document.querySelectorAll(sel)];
const uid=()=>crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const todayISO=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>d ? new Intl.DateTimeFormat('ms-MY',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${d}T12:00:00`)) : '-';
const escapeHtml=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const daysBetween=(a,b)=>Math.round((new Date(b)-new Date(a))/86400000);
const daysUntil=d=>Math.ceil((new Date(`${d}T23:59:59`)-new Date())/86400000);

function normalizeName(name=''){
  let n=name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  const aliases=[
    [/cili (api|padi)/g,'cili padi'],[/santan (kotak|pekat|cair)/g,'santan'],[/ayam (seekor|potong|bahagian)/g,'ayam'],
    [/bawang merah kecil/g,'bawang merah'],[/bawang besar/g,'bawang besar'],[/kunyit hidup/g,'kunyit'],[/serbuk kunyit/g,'kunyit serbuk'],
    [/sos cili/g,'sos cili'],[/kicap manis/g,'kicap manis'],[/kicap masin/g,'kicap masin'],[/minyak masak/g,'minyak'],[/beras wangi/g,'beras']
  ];
  aliases.forEach(([re,to])=>n=n.replace(re,to));
  return n;
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=e=>{
      const d=e.target.result;
      STORE_NAMES.forEach(name=>{ if(!d.objectStoreNames.contains(name)) d.createObjectStore(name,{keyPath:'id'}); });
    };
    req.onsuccess=e=>{db=e.target.result;resolve(db)};
    req.onerror=e=>reject(e.target.error);
  });
}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function getAll(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function getOne(store,id){return new Promise((res,rej)=>{const r=tx(store).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(store,val){return new Promise((res,rej)=>{const r=tx(store,'readwrite').put(val);r.onsuccess=()=>res(val);r.onerror=()=>rej(r.error)})}
function del(store,id){return new Promise((res,rej)=>{const r=tx(store,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearStore(store){return new Promise((res,rej)=>{const r=tx(store,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}

const seedRecipes=[
  {id:'r1',title:'Ayam Masak Lemak Cili Api',category:'Masakan Melayu',time:40,sourceName:'DapurKu',sourceUrl:'',note:'Versi ingredient-planning untuk semak stok. Sukatan boleh disesuaikan ikut jumlah hidangan.',ingredients:['ayam','santan','cili padi','kunyit hidup','serai','asam keping','garam']},
  {id:'r2',title:'Daging Masak Lemak Cili Api',category:'Masakan Melayu',time:55,sourceName:'DapurKu',sourceUrl:'',note:'Senarai bahan asas untuk planning pembelian.',ingredients:['daging','santan','cili padi','kunyit hidup','serai','asam keping','garam']},
  {id:'r3',title:'Ayam Masak Kicap',category:'Masakan Melayu',time:35,sourceName:'DapurKu',sourceUrl:'',note:'Senarai bahan asas untuk planning pembelian.',ingredients:['ayam','kicap manis','bawang besar','bawang putih','halia','cili merah','kentang','garam']},
  {id:'r4',title:'Sambal Tumis Ikan Bilis',category:'Masakan Melayu',time:35,sourceName:'DapurKu',sourceUrl:'',note:'Senarai bahan asas untuk planning pembelian.',ingredients:['ikan bilis','cili kering','bawang merah','bawang putih','asam jawa','gula','garam','minyak masak']},
  {id:'r5',title:'Kari Ayam Pecah Minyak & Kuah Merah',category:'Che Nom',time:75,sourceName:'Che Nom',sourceUrl:'https://resepichenom.com/resepi',note:'Bahan di sini ialah checklist planning DapurKu, bukan salinan sukatan/langkah rasmi. Buka sumber untuk resepi asal.',ingredients:['ayam','serbuk kari ayam','santan','kentang','bawang merah','bawang putih','halia','daun kari','rempah 4 sekawan']},
  {id:'r6',title:'Ikan Siakap 3 Rasa Gaya Restoran Thai',category:'Che Nom',time:45,sourceName:'Che Nom',sourceUrl:'https://resepichenom.com/resepi',note:'Checklist bahan untuk semak pantry. Rujuk Che Nom untuk sukatan dan teknik asal.',ingredients:['ikan siakap','bawang putih','cili padi','cili merah','nanas','sos cili','sos tomato','sos ikan','limau nipis']},
  {id:'r7',title:'Mee Goreng Mamak',category:'Che Nom',time:40,sourceName:'Che Nom',sourceUrl:'https://resepichenom.com/resepi',note:'Checklist bahan untuk planning pembelian.',ingredients:['mee kuning','tauhu','taugeh','telur','kentang','sawi','sos cili','kicap manis','limau nipis']},
  {id:'r8',title:'Sambal Sotong',category:'Che Nom',time:50,sourceName:'Che Nom',sourceUrl:'https://resepichenom.com/resepi',note:'Checklist bahan untuk planning pembelian.',ingredients:['sotong','cili kering','bawang merah','bawang putih','gula melaka','sos tiram','asam jawa','garam']},
  {id:'r9',title:'Asam Laksa Penang',category:'Che Nom',time:110,sourceName:'Che Nom',sourceUrl:'https://resepichenom.com/resepi',note:'Checklist bahan ringkas untuk planning. Rujuk sumber rasmi untuk sukatan penuh.',ingredients:['laksa beras','ikan kembung','asam keping','daun kesum','bunga kantan','cili kering','bawang besar','timun','nanas']},
  {id:'r10',title:'Telur Dadar Bawang Cili',category:'Che Nom',time:15,sourceName:'Che Nom',sourceUrl:'https://resepichenom.com/resepi',note:'Checklist bahan ringkas untuk planning.',ingredients:['telur','bawang besar','cili merah','daun bawang','garam']},
  {id:'r11',title:'Nasi Goreng Kampung',category:'Masakan Melayu',time:25,sourceName:'DapurKu',sourceUrl:'',note:'Senarai bahan asas untuk planning pembelian.',ingredients:['nasi','ikan bilis','telur','kangkung','cili padi','bawang merah','bawang putih','kicap manis']},
  {id:'r12',title:'Sup Ayam',category:'Masakan Melayu',time:45,sourceName:'DapurKu',sourceUrl:'',note:'Senarai bahan asas untuk planning pembelian.',ingredients:['ayam','kentang','lobak merah','bawang besar','bawang putih','halia','sup bunjut','daun sup','bawang goreng']},
  {id:'r13',title:'Ayam Goreng Kunyit',category:'Masakan Melayu',time:25,sourceName:'DapurKu',sourceUrl:'',note:'Senarai bahan asas untuk planning pembelian.',ingredients:['ayam','kunyit serbuk','kacang panjang','lobak merah','bawang besar','cili merah','garam']},
  {id:'r14',title:'Ikan Goreng Berlada',category:'Masakan Melayu',time:30,sourceName:'DapurKu',sourceUrl:'',note:'Senarai bahan asas untuk planning pembelian.',ingredients:['ikan kembung','cili merah','cili padi','bawang besar','bawang putih','limau kasturi','garam']},
  {id:'r15',title:'Tomyam Ayam',category:'Masakan Thai',time:35,sourceName:'DapurKu',sourceUrl:'',note:'Senarai bahan asas untuk planning pembelian.',ingredients:['ayam','pes tomyam','serai','daun limau purut','lengkuas','cendawan','tomato','bawang besar','cili padi','limau nipis']},
  {id:'r16',title:'Bihun Goreng',category:'Masakan Harian',time:30,sourceName:'DapurKu',sourceUrl:'',note:'Senarai bahan asas untuk planning pembelian.',ingredients:['bihun','telur','sawi','lobak merah','bawang putih','bawang merah','sos tiram','kicap manis']},
  {id:'r17',title:'Ketam Masak Lemak Cili Api Pucuk Paku',category:'Che Nom',time:35,sourceName:'Che Nom',sourceUrl:'https://resepichenom.com/resepi',note:'Checklist bahan untuk planning pembelian; buka sumber rasmi untuk sukatan/kaedah asal.',ingredients:['ketam','pucuk paku','santan','cili padi','kunyit hidup','serai','garam']},
  {id:'r18',title:'Ayam Penyet Sambal Ijo',category:'Che Nom',time:70,sourceName:'Che Nom',sourceUrl:'https://resepichenom.com/resepi',note:'Checklist bahan ringkas untuk planning.',ingredients:['ayam','tempe','tauhu','cili hijau','bawang merah','bawang putih','limau nipis','timun']}
].map(r=>({...r,ingredients:r.ingredients.map(x=>({name:x}))}));

function isoMinus(days){const d=new Date();d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)}
function isoPlus(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}

const seedItems=[
  ['Ayam','Fresh','Freezer','in',false,isoPlus(18),'',1,'pack'],
  ['Santan','Pantry','Pantry','low',true,isoPlus(90),'',1,'kotak'],
  ['Cili padi','Fresh','Fridge','out',true,isoPlus(5),'',1,'pack'],
  ['Serai','Fresh','Fridge','in',false,isoPlus(7),'',5,'batang'],
  ['Garam','Pantry','Pantry','in',true,'','',1,'pack'],
  ['Telur','Dairy','Pantry','low',true,isoPlus(9),'',8,'biji'],
  ['Milo','Drinks','Pantry','out',true,isoPlus(180),'9556001122334',1,'pack'],
  ['Minyak masak','Pantry','Pantry','low',true,isoPlus(120),'',1,'botol'],
  ['Bawang besar','Fresh','Pantry','in',true,isoPlus(12),'',4,'biji'],
  ['Bawang putih','Fresh','Pantry','in',true,isoPlus(20),'',1,'labu'],
  ['Halia','Fresh','Fridge','in',false,isoPlus(12),'',1,'ketul'],
  ['Kentang','Fresh','Pantry','in',false,isoPlus(15),'',5,'biji'],
  ['Susu segar','Dairy','Fridge','in',true,isoPlus(2),'',1,'botol'],
  ['Yogurt','Dairy','Fridge','in',false,isoPlus(4),'',2,'cup'],
  ['Kicap manis','Sauce','Pantry','in',true,isoPlus(200),'',1,'botol']
].map((x,i)=>({id:`i${i+1}`,name:x[0],category:x[1],location:x[2],status:x[3],favorite:x[4],expiry:x[5],barcode:x[6],qty:x[7],unit:x[8],createdAt:todayISO(),updatedAt:todayISO()}));

const seedHistory=[
 {id:'h1',date:isoMinus(62),store:'Lotus',total:96.20,items:[{name:'Milo'},{name:'Telur'},{name:'Minyak masak'},{name:'Santan'}]},
 {id:'h2',date:isoMinus(35),store:'Lotus',total:84.50,items:[{name:'Milo'},{name:'Telur'},{name:'Santan'}]},
 {id:'h3',date:isoMinus(8),store:'NSK',total:72.10,items:[{name:'Milo'},{name:'Telur'},{name:'Minyak masak'}]}
];

async function seedIfNeeded(){
  const settings=await getAll('settings');
  if(settings.find(x=>x.id==='initialized')) return;
  for(const r of seedRecipes) await put('recipes',r);
  for(const i of seedItems) await put('items',i);
  for(const h of seedHistory) await put('history',h);
  await put('settings',{id:'initialized',value:true});
  await put('settings',{id:'demo',value:true});
  await syncAutoShopping();
}

async function syncAutoShopping(){
  const items=await getAll('items');
  let shopping=await getAll('shopping');
  for(const item of items){
    const existing=shopping.find(s=>s.itemId===item.id && s.source==='auto');
    if(item.status==='low' || item.status==='out'){
      if(!existing){
        const entry={id:uid(),itemId:item.id,name:item.name,category:item.category||'Lain-lain',qty:1,unit:item.unit||'',checked:false,source:'auto',reason:item.status,createdAt:new Date().toISOString()};
        await put('shopping',entry);shopping.push(entry);
      } else if(existing.reason!==item.status || existing.name!==item.name){
        existing.reason=item.status;existing.name=item.name;existing.category=item.category||existing.category;await put('shopping',existing);
      }
    } else if(existing){await del('shopping',existing.id);shopping=shopping.filter(s=>s.id!==existing.id)}
  }
}

function statusLabel(s){return s==='in'?'Ada':s==='low'?'Nak Habis':'Habis'}
function statusBadge(s){return `<span class="badge ${s==='in'?'badge-ok':s==='low'?'badge-low':'badge-out'}">${statusLabel(s)}</span>`}
function categoryIcon(cat=''){const c=cat.toLowerCase();if(c.includes('fresh'))return'🥬';if(c.includes('dairy'))return'🥛';if(c.includes('drink'))return'🥤';if(c.includes('sauce'))return'🧂';if(c.includes('house'))return'🧼';if(c.includes('frozen'))return'🧊';return'🥫'}
function itemMatch(ingredient,items){
  const target=normalizeName(ingredient);
  return items.find(i=>{const n=normalizeName(i.name);return n===target||n.includes(target)||target.includes(n)})||null;
}
function recipeAssessment(recipe,items){
  const details=recipe.ingredients.map(ing=>{const found=itemMatch(ing.name,items);let state='missing';if(found) state=found.status==='in'?'have':found.status==='low'?'low':'missing';return {name:ing.name,item:found,state};});
  const have=details.filter(d=>d.state==='have').length;
  const low=details.filter(d=>d.state==='low').length;
  const total=details.length;
  const score=Math.round(((have+low*.5)/Math.max(total,1))*100);
  return {details,have,low,missing:details.filter(d=>d.state==='missing'),score,total};
}

async function getDemoFlag(){const d=await getOne('settings','demo');return !!d?.value}

function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2300)}
function closeModal(){const root=$('#modalRoot');root.innerHTML='';window.__stopScanner?.();window.__stopScanner=null}
function modal(title,body){$('#modalRoot').innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="close-btn" id="modalClose">✕</button></div>${body}</div></div>`;$('#modalClose').onclick=closeModal;$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});}

async function render(){await syncAutoShopping();await Promise.all([renderHome(),renderShop(),renderPantry(),renderRecipes(),renderMore()]);}

async function renderHome(){
  const [items,shopping,recipes]=await Promise.all([getAll('items'),getAll('shopping'),getAll('recipes')]);
  const demo=await getDemoFlag();
  const low=items.filter(i=>i.status==='low');const out=items.filter(i=>i.status==='out');const exp=items.filter(i=>i.expiry&&daysUntil(i.expiry)>=0&&daysUntil(i.expiry)<=7).sort((a,b)=>a.expiry.localeCompare(b.expiry));
  const predictions=await buildPredictions();
  const assessed=recipes.map(r=>({r,a:recipeAssessment(r,items)})).sort((x,y)=>y.a.score-x.a.score).slice(0,3);
  $('#view-home').innerHTML=`
    <div class="hero"><h2>Apa ada, apa nak beli, apa boleh masak.</h2><p>DapurKu urus stok secara simple: <b>Ada → Nak Habis → Habis</b>. Tak perlu kira setiap sudu atau biji.</p></div>
    ${demo?`<div class="demo-banner"><span>🧪</span><div><b>Demo data aktif</b><br>Data contoh dimasukkan supaya semua function terus nampak.</div><button class="btn btn-small btn-secondary" id="startBlankBtn">Mula kosong</button></div>`:''}
    <div class="grid2">
      <div class="stat-card" data-go="shop"><div class="ico">🛒</div><strong>${shopping.filter(x=>!x.checked).length}</strong><span>Perlu dibeli</span></div>
      <div class="stat-card" data-go="pantry"><div class="ico">⚠️</div><strong>${low.length}</strong><span>Nak habis</span></div>
      <div class="stat-card"><div class="ico">⏰</div><strong>${exp.length}</strong><span>Expiring ≤ 7 hari</span></div>
      <div class="stat-card" data-go="pantry"><div class="ico">🥫</div><strong>${items.length}</strong><span>Barang direkod</span></div>
    </div>
    <div class="section-head"><div><h3>Quick Add</h3><p>Update dapur dalam 1–2 tap.</p></div></div>
    <div class="quick-actions"><button id="qaItem"><span>➕</span>Barang</button><button id="qaShop"><span>📝</span>List</button><button id="qaRecipe"><span>🍳</span>Resipi</button></div>
    <div class="section-head"><div><h3>⏰ Expiring Soon</h3><p>Prioriti guna dulu.</p></div></div>
    ${exp.length?`<div class="list">${exp.slice(0,5).map(i=>`<div class="row-card"><div>${categoryIcon(i.category)}</div><div class="row-main"><div class="row-title">${escapeHtml(i.name)}</div><div class="row-sub">${i.location} • ${daysUntil(i.expiry)===0?'Hari ini':daysUntil(i.expiry)===1?'Esok':`${daysUntil(i.expiry)} hari lagi`}</div></div><span class="badge ${daysUntil(i.expiry)<=1?'badge-out':'badge-low'}">${fmtDate(i.expiry)}</span></div>`).join('')}</div>`:`<div class="empty"><div class="big">✅</div>Tiada barang nak expired dalam 7 hari.</div>`}
    <div class="section-head"><div><h3>🧠 Smart Prediction</h3><p>Berdasarkan corak Purchase History.</p></div></div>
    ${predictions.length?predictions.slice(0,4).map(p=>`<div class="prediction"><strong>${escapeHtml(p.name)} mungkin dah hampir habis</strong><small>Biasanya dibeli setiap ~${p.avg} hari • kali terakhir ${p.daysSince} hari lepas.</small><div style="margin-top:9px"><button class="btn btn-small btn-secondary pred-check" data-name="${escapeHtml(p.name)}">Semak stok</button></div></div>`).join(''):`<div class="empty">Bila Purchase History dah cukup, prediction akan muncul di sini.</div>`}
    <div class="section-head"><div><h3>🍳 Apa Boleh Masak?</h3><p>Resipi paling hampir dengan stok sekarang.</p></div><button class="btn btn-small btn-secondary" data-go="recipes">Lihat semua</button></div>
    ${assessed.map(({r,a})=>`<div class="recipe-card recipe-open" data-id="${r.id}"><div class="recipe-top"><div><h4>${escapeHtml(r.title)}</h4><div class="recipe-meta">${escapeHtml(r.category)} • ${r.time||'-'} min</div></div><div class="recipe-score">${a.score}% ada</div></div><div class="progress"><i style="width:${a.score}%"></i></div><div class="chips" style="margin-top:9px">${a.missing.slice(0,3).map(x=>`<span class="chip missing">Perlu: ${escapeHtml(x.name)}</span>`).join('')}${a.missing.length>3?`<span class="chip">+${a.missing.length-3}</span>`:''}</div></div>`).join('')}
    ${out.length?`<div class="section-head"><div><h3>🔴 Dah Habis</h3><p>Auto masuk Shopping List.</p></div></div><div class="list">${out.slice(0,6).map(i=>`<div class="row-card"><div>${categoryIcon(i.category)}</div><div class="row-main"><div class="row-title">${escapeHtml(i.name)}</div><div class="row-sub">${escapeHtml(i.location)}</div></div>${statusBadge(i.status)}</div>`).join('')}</div>`:''}
  `;
  $$('[data-go]').forEach(x=>x.onclick=()=>switchView(x.dataset.go));
  $('#qaItem').onclick=()=>openItemForm();$('#qaShop').onclick=()=>openShoppingForm();$('#qaRecipe').onclick=()=>openRecipeForm();
  $$('.recipe-open').forEach(x=>x.onclick=()=>openRecipeDetail(x.dataset.id));
  $$('.pred-check').forEach(x=>x.onclick=()=>openPredictionCheck(x.dataset.name));
  if($('#startBlankBtn')) $('#startBlankBtn').onclick=confirmStartBlank;
}

async function renderShop(){
  const shopping=(await getAll('shopping')).sort((a,b)=>Number(a.checked)-Number(b.checked)||a.category.localeCompare(b.category));
  const groups={};shopping.forEach(s=>(groups[s.category||'Lain-lain']??=[]).push(s));
  const pending=shopping.filter(x=>!x.checked).length;
  $('#view-shop').innerHTML=`
    <div class="section-head"><div><h3>Shopping List</h3><p>${pending} barang belum selesai.</p></div><button class="btn ${shoppingMode?'btn-primary':'btn-secondary'}" id="shopModeBtn">${shoppingMode?'✓ Finish Shopping':'🛒 Start Shopping'}</button></div>
    <div class="${shoppingMode?'shopping-mode':''}">
      ${shopping.length?Object.entries(groups).map(([cat,arr])=>`<div class="shop-group"><h4>${escapeHtml(cat)}</h4>${arr.map(s=>`<div class="shop-item ${s.checked?'done':''}"><input class="shop-check" data-id="${s.id}" type="checkbox" ${s.checked?'checked':''}><div class="row-main"><div class="row-title">${escapeHtml(s.name)} ${s.qty&&s.qty!==1?`×${s.qty}`:''}</div><div class="row-sub">${s.source==='auto'?(s.reason==='out'?'Auto • Habis':'Auto • Nak Habis'):'Manual'}${s.unit?` • ${escapeHtml(s.unit)}`:''}</div></div>${!shoppingMode && s.source!=='auto'?`<button class="mini-btn shop-delete" data-id="${s.id}">🗑️</button>`:''}</div>`).join('')}</div>`).join(''):`<div class="empty"><div class="big">🛒</div>Shopping List kosong.<br>Barang berstatus <b>Nak Habis</b> atau <b>Habis</b> akan masuk automatik.</div>`}
    </div>
    <button class="fab" id="addShopFab">+</button>
  `;
  $('#addShopFab').onclick=()=>openShoppingForm();
  $$('.shop-check').forEach(c=>c.onchange=async()=>{const s=await getOne('shopping',c.dataset.id);s.checked=c.checked;await put('shopping',s);renderShop()});
  $$('.shop-delete').forEach(b=>b.onclick=async()=>{await del('shopping',b.dataset.id);toast('Dibuang daripada Shopping List');render()});
  $('#shopModeBtn').onclick=async()=>{
    if(!shoppingMode){shoppingMode=true;renderShop();toast('Shopping Mode aktif');}
    else await finishShopping();
  };
}

async function renderPantry(){
  const items=(await getAll('items')).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.name.localeCompare(b.name));
  $('#view-pantry').innerHTML=`
    <div class="section-head"><div><h3>Pantry</h3><p>${items.length} barang • tukar status dengan 1 tap.</p></div></div>
    <div class="toolbar"><input id="pantrySearch" placeholder="Cari barang..."><select id="pantryStatus"><option value="">Semua status</option><option value="in">Ada</option><option value="low">Nak Habis</option><option value="out">Habis</option></select><select id="pantryLocation"><option value="">Semua lokasi</option>${[...new Set(items.map(i=>i.location))].filter(Boolean).map(x=>`<option>${escapeHtml(x)}</option>`).join('')}</select></div>
    <div id="pantryList"></div><button class="fab" id="addPantryFab">+</button>`;
  const draw=()=>{
    const q=normalizeName($('#pantrySearch').value);const st=$('#pantryStatus').value;const loc=$('#pantryLocation').value;
    const filtered=items.filter(i=>(!q||normalizeName(i.name).includes(q))&&(!st||i.status===st)&&(!loc||i.location===loc));
    $('#pantryList').innerHTML=filtered.length?`<div class="list">${filtered.map(i=>`<div class="row-card"><div>${i.favorite?'⭐':categoryIcon(i.category)}</div><div class="row-main"><div class="row-title">${escapeHtml(i.name)}</div><div class="row-sub">${escapeHtml(i.location||'-')} • ${escapeHtml(i.category||'-')}${i.expiry?` • exp ${fmtDate(i.expiry)}`:''}</div><div class="status-pills" style="margin-top:8px"><button class="status-set ${i.status==='in'?'active in':''}" data-id="${i.id}" data-status="in">Ada</button><button class="status-set ${i.status==='low'?'active low':''}" data-id="${i.id}" data-status="low">Nak Habis</button><button class="status-set ${i.status==='out'?'active out':''}" data-id="${i.id}" data-status="out">Habis</button></div></div><button class="mini-btn pantry-edit" data-id="${i.id}">✏️</button></div>`).join('')}</div>`:`<div class="empty">Tiada barang ikut filter ini.</div>`;
    $$('.status-set').forEach(b=>b.onclick=async()=>{const item=await getOne('items',b.dataset.id);item.status=b.dataset.status;item.updatedAt=todayISO();await put('items',item);await syncAutoShopping();toast(`${item.name}: ${statusLabel(item.status)}`);render()});
    $$('.pantry-edit').forEach(b=>b.onclick=()=>openItemForm(b.dataset.id));
  };
  ['pantrySearch','pantryStatus','pantryLocation'].forEach(id=>$('#'+id).addEventListener('input',draw));draw();
  $('#addPantryFab').onclick=()=>openItemForm();
}

async function renderRecipes(){
  const [recipes,items]=await Promise.all([getAll('recipes'),getAll('items')]);
  const cats=[...new Set(recipes.map(r=>r.category))].sort();
  $('#view-recipes').innerHTML=`
    <div class="section-head"><div><h3>Apa Boleh Masak?</h3><p>Banding bahan resipi dengan stok DapurKu.</p></div><button class="btn btn-small btn-secondary" id="addRecipeBtn">+ Resipi</button></div>
    <div class="note">Untuk resipi berlabel <b>Che Nom</b>, DapurKu simpan ingredient-planning sahaja. Sukatan dan langkah asal kekal dirujuk melalui laman rasmi.</div>
    <div class="toolbar"><input id="recipeSearch" placeholder="Contoh: masak lemak"><select id="recipeCategory"><option value="">Semua kategori</option>${cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('')}</select></div>
    <div id="recipeList"></div>`;
  const draw=()=>{
    const q=normalizeName($('#recipeSearch').value);const cat=$('#recipeCategory').value;
    const list=recipes.filter(r=>(!q||normalizeName(r.title).includes(q)||r.ingredients.some(i=>normalizeName(i.name).includes(q)))&&(!cat||r.category===cat)).map(r=>({r,a:recipeAssessment(r,items)})).sort((x,y)=>y.a.score-x.a.score||x.r.title.localeCompare(y.r.title));
    $('#recipeList').innerHTML=list.length?list.map(({r,a})=>`<div class="recipe-card recipe-open" data-id="${r.id}"><div class="recipe-top"><div><h4>${escapeHtml(r.title)}</h4><div class="recipe-meta">${escapeHtml(r.category)} • ${r.time||'-'} min • ${escapeHtml(r.sourceName||'DapurKu')}</div></div><div class="recipe-score">${a.score}%</div></div><div class="progress"><i style="width:${a.score}%"></i></div><div class="chips" style="margin-top:10px">${a.have?`<span class="chip">✅ ${a.have} ada</span>`:''}${a.low?`<span class="chip low">⚠️ ${a.low} low</span>`:''}${a.missing.length?`<span class="chip missing">🛒 ${a.missing.length} perlu beli</span>`:'<span class="chip">🎉 Semua cukup</span>'}</div></div>`).join(''):`<div class="empty">Resipi tak dijumpai.</div>`;
    $$('.recipe-open').forEach(x=>x.onclick=()=>openRecipeDetail(x.dataset.id));
  };
  $('#recipeSearch').addEventListener('input',draw);$('#recipeCategory').addEventListener('change',draw);$('#addRecipeBtn').onclick=()=>openRecipeForm();draw();
}

async function renderMore(){
  const history=(await getAll('history')).sort((a,b)=>b.date.localeCompare(a.date));
  const items=await getAll('items');
  $('#view-more').innerHTML=`
    <div class="section-head"><div><h3>Purchase History</h3><p>Digunakan untuk Smart Prediction.</p></div></div>
    ${history.length?history.slice(0,12).map(h=>`<div class="history-card"><div class="history-head"><div><b>${fmtDate(h.date)}</b><div class="row-sub">${escapeHtml(h.store||'Kedai')}</div></div><b>${h.total?`RM ${Number(h.total).toFixed(2)}`:''}</b></div><div class="history-items">${h.items.map(x=>escapeHtml(x.name)).join(' • ')}</div></div>`).join(''):`<div class="empty">Belum ada purchase history.</div>`}
    <div class="section-head"><div><h3>Data & Backup</h3><p>${items.length} pantry items disimpan local dalam device.</p></div></div>
    <div class="list"><button class="btn btn-secondary btn-block" id="exportBtn">⬇️ Export Backup JSON</button><button class="btn btn-secondary btn-block" id="importBtn">⬆️ Import Backup JSON</button><input id="importFile" class="hidden" type="file" accept="application/json"><button class="btn btn-secondary btn-block" id="scanBtn">📷 Scan Barcode</button></div>
    <div class="section-head"><div><h3>About</h3></div></div><div class="note">DapurKu v1 • Offline-first PWA • IndexedDB • Auto shopping • Expiry • Purchase History • Smart Prediction • Recipe pantry matching.</div>
    <div class="danger-zone"><b>Reset</b><p class="row-sub">Padam semua data local dan mula kosong.</p><button class="btn btn-danger" id="resetBtn">Padam semua data</button></div>`;
  $('#exportBtn').onclick=exportData;$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=importData;$('#resetBtn').onclick=confirmReset;$('#scanBtn').onclick=()=>openScanner(code=>toast(`Barcode: ${code}`));
}

function switchView(name){currentView=name;$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));window.scrollTo({top:0,behavior:'smooth'});}

async function openItemForm(id=null){
  const item=id?await getOne('items',id):{name:'',category:'Pantry',location:'Pantry',status:'in',favorite:false,expiry:'',barcode:'',qty:1,unit:''};
  modal(id?'Edit Barang':'Tambah Barang',`<form id="itemForm"><div class="form-grid">
    <div class="field full"><label>Nama barang</label><input name="name" required value="${escapeHtml(item.name)}" placeholder="Contoh: Santan"></div>
    <div class="field"><label>Category</label><select name="category">${['Pantry','Fresh','Dairy','Frozen','Drinks','Sauce','Household','Lain-lain'].map(x=>`<option ${item.category===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="field"><label>Lokasi</label><select name="location">${['Pantry','Fridge','Freezer','Kitchen','Household'].map(x=>`<option ${item.location===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="field"><label>Status</label><select name="status"><option value="in" ${item.status==='in'?'selected':''}>Ada</option><option value="low" ${item.status==='low'?'selected':''}>Nak Habis</option><option value="out" ${item.status==='out'?'selected':''}>Habis</option></select></div>
    <div class="field"><label>Expiry (optional)</label><input type="date" name="expiry" value="${item.expiry||''}"></div>
    <div class="field"><label>Quantity (optional)</label><input type="number" min="0" step="0.1" name="qty" value="${item.qty??1}"></div>
    <div class="field"><label>Unit</label><input name="unit" value="${escapeHtml(item.unit||'')}" placeholder="pack / botol / kg"></div>
    <div class="field full"><label>Barcode</label><div style="display:flex;gap:8px"><input id="barcodeField" style="flex:1" name="barcode" value="${escapeHtml(item.barcode||'')}" placeholder="Scan atau isi manual"><button type="button" class="btn btn-secondary" id="barcodeScanBtn">📷 Scan</button></div></div>
    <div class="field full"><label><input type="checkbox" name="favorite" ${item.favorite?'checked':''}> ⭐ Always Keep Stocked</label></div>
  </div><div class="form-actions">${id?'<button type="button" class="btn btn-danger" id="deleteItemBtn">Delete</button>':''}<button class="btn btn-primary" type="submit">Save</button></div></form>`);
  $('#barcodeScanBtn').onclick=()=>openScanner(code=>{const f=$('#barcodeField');if(f)f.value=code;toast('Barcode captured')});
  $('#itemForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const obj={...item,id:item.id||uid(),name:f.get('name').trim(),category:f.get('category'),location:f.get('location'),status:f.get('status'),expiry:f.get('expiry'),qty:Number(f.get('qty')||1),unit:f.get('unit').trim(),barcode:f.get('barcode').trim(),favorite:f.get('favorite')==='on',createdAt:item.createdAt||todayISO(),updatedAt:todayISO()};await put('items',obj);await syncAutoShopping();closeModal();toast('Barang disimpan');render()};
  if(id) $('#deleteItemBtn').onclick=async()=>{if(confirm(`Padam ${item.name}?`)){await del('items',id);const shopping=await getAll('shopping');for(const s of shopping.filter(x=>x.itemId===id)) await del('shopping',s.id);closeModal();render();}};
}

function openShoppingForm(prefill=''){
  modal('Tambah Shopping List',`<form id="shopForm"><div class="form-grid"><div class="field full"><label>Barang</label><input name="name" required value="${escapeHtml(prefill)}" placeholder="Contoh: Susu"></div><div class="field"><label>Category</label><select name="category">${['Pantry','Fresh','Dairy','Frozen','Drinks','Sauce','Household','Lain-lain'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Quantity</label><input name="qty" type="number" min="1" value="1"></div></div><div class="form-actions"><button class="btn btn-primary" type="submit">Tambah</button></div></form>`);
  $('#shopForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await put('shopping',{id:uid(),name:f.get('name').trim(),category:f.get('category'),qty:Number(f.get('qty')||1),checked:false,source:'manual',createdAt:new Date().toISOString()});closeModal();toast('Masuk Shopping List');render()};
}

async function finishShopping(){
  const all=await getAll('shopping');const checked=all.filter(x=>x.checked);
  if(!checked.length){toast('Tick barang yang dah dibeli dulu');return}
  modal('Finish Shopping',`<form id="finishForm"><div class="field"><label>Kedai (optional)</label><input name="store" placeholder="Lotus / NSK / AEON"></div><div class="field"><label>Total belanja RM (optional)</label><input name="total" type="number" min="0" step="0.01" placeholder="0.00"></div><div class="note">${checked.length} barang akan direkod dalam Purchase History dan status pantry ditukar kepada <b>Ada</b>.</div><div class="form-actions"><button class="btn btn-primary" type="submit">✓ Selesai & Restock</button></div></form>`);
  $('#finishForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const items=await getAll('items');const histItems=[];
    for(const s of checked){let item=s.itemId?items.find(i=>i.id===s.itemId):itemMatch(s.name,items);if(item){item.status='in';item.updatedAt=todayISO();item.lastPurchasedAt=todayISO();await put('items',item)}else{item={id:uid(),name:s.name,category:s.category||'Lain-lain',location:'Pantry',status:'in',favorite:false,expiry:'',barcode:'',qty:s.qty||1,unit:'',createdAt:todayISO(),updatedAt:todayISO(),lastPurchasedAt:todayISO()};await put('items',item)}histItems.push({name:s.name,qty:s.qty||1});await del('shopping',s.id)}
    await put('history',{id:uid(),date:todayISO(),store:f.get('store').trim(),total:Number(f.get('total')||0),items:histItems});shoppingMode=false;closeModal();await syncAutoShopping();toast('Shopping selesai & pantry direstock');render();
  };
}

async function openRecipeDetail(id){
  const [r,items]=await Promise.all([getOne('recipes',id),getAll('items')]);if(!r)return;const a=recipeAssessment(r,items);
  modal(escapeHtml(r.title),`<div class="recipe-meta">${escapeHtml(r.category)} • ${r.time||'-'} min • ${escapeHtml(r.sourceName||'DapurKu')}</div><div class="progress"><i style="width:${a.score}%"></i></div><div class="note">${escapeHtml(r.note||'Ingredient checklist untuk planning pembelian.')}</div><div class="ingredient-list">${a.details.map(d=>`<div class="ingredient ${d.state}"><span class="dot"></span><div class="row-main"><b>${escapeHtml(d.name)}</b><div class="row-sub">${d.state==='have'?'Ada dalam pantry':d.state==='low'?'Ada tapi nak habis':'Tak ada / habis'}</div></div>${d.state==='have'?'<span class="badge badge-ok">Ada</span>':d.state==='low'?'<span class="badge badge-low">Low</span>':'<span class="badge badge-out">Beli</span>'}</div>`).join('')}</div>
  ${a.missing.length||a.low?`<button class="btn btn-primary btn-block" id="addMissingBtn">🛒 Tambah bahan perlu ke Shopping</button>`:'<div class="empty">🎉 Semua bahan utama dah ada.</div>'}
  ${r.sourceUrl?`<a class="btn btn-secondary btn-block" style="display:block;text-align:center;text-decoration:none;margin-top:9px" href="${r.sourceUrl}" target="_blank" rel="noopener">Buka sumber ${escapeHtml(r.sourceName||'asal')} ↗</a>`:''}`);
  if($('#addMissingBtn')) $('#addMissingBtn').onclick=async()=>{for(const d of a.details.filter(x=>x.state!=='have')){const existing=(await getAll('shopping')).find(s=>normalizeName(s.name)===normalizeName(d.name)&&!s.checked);if(!existing)await put('shopping',{id:uid(),name:d.name,category:'Resipi',qty:1,checked:false,source:'recipe',createdAt:new Date().toISOString()})}closeModal();toast('Bahan yang kurang masuk Shopping List');render()};
}

function openRecipeForm(){
  modal('Tambah Resipi Sendiri',`<form id="recipeForm"><div class="field"><label>Nama resipi</label><input name="title" required placeholder="Contoh: Ikan masak sambal"></div><div class="field"><label>Kategori</label><input name="category" value="Resipi Saya"></div><div class="field"><label>Masa (minit)</label><input type="number" name="time" value="30"></div><div class="field"><label>Bahan — satu setiap baris</label><textarea name="ingredients" required placeholder="ikan\ncili kering\nbawang merah\ngaram"></textarea></div><div class="field"><label>Source URL (optional)</label><input type="url" name="sourceUrl" placeholder="https://..."></div><div class="form-actions"><button class="btn btn-primary" type="submit">Save Resipi</button></div></form>`);
  $('#recipeForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const ingredients=f.get('ingredients').split(/\n|,/).map(s=>s.trim()).filter(Boolean).map(name=>({name}));await put('recipes',{id:uid(),title:f.get('title').trim(),category:f.get('category').trim()||'Resipi Saya',time:Number(f.get('time')||0),sourceName:f.get('sourceUrl')?'Sumber luar':'DapurKu',sourceUrl:f.get('sourceUrl').trim(),note:'Resipi custom pengguna.',ingredients});closeModal();toast('Resipi disimpan');render()};
}

async function buildPredictions(){
  const [history,items]=await Promise.all([getAll('history'),getAll('items')]);
  const by={};history.sort((a,b)=>a.date.localeCompare(b.date)).forEach(h=>h.items.forEach(it=>{const key=normalizeName(it.name);(by[key]??={name:it.name,dates:[]}).dates.push(h.date)}));
  const out=[];for(const k of Object.keys(by)){const d=by[k].dates;if(d.length<2)continue;const ints=[];for(let i=1;i<d.length;i++)ints.push(daysBetween(d[i-1],d[i]));const avg=Math.round(ints.reduce((a,b)=>a+b,0)/ints.length);const last=d[d.length-1];const ds=daysBetween(last,todayISO());const item=itemMatch(by[k].name,items);if(avg>0&&ds>=Math.max(3,Math.floor(avg*.78))&&(!item||item.status==='in'))out.push({name:by[k].name,avg,daysSince:ds,ratio:ds/avg});}
  return out.sort((a,b)=>b.ratio-a.ratio);
}

async function openPredictionCheck(name){
  const items=await getAll('items');const item=itemMatch(name,items);
  modal(`Semak ${escapeHtml(name)}`,`<div class="note">Prediction cuma prompt untuk semak — DapurKu tak ubah stok sendiri.</div><div class="status-pills" style="justify-content:center;gap:9px"><button class="btn btn-secondary pred-set" data-status="in">✅ Masih ada</button><button class="btn btn-secondary pred-set" data-status="low">⚠️ Nak habis</button><button class="btn btn-danger pred-set" data-status="out">🔴 Habis</button></div>`);
  $$('.pred-set').forEach(b=>b.onclick=async()=>{let target=item;if(!target){target={id:uid(),name,category:'Pantry',location:'Pantry',favorite:false,expiry:'',barcode:'',qty:1,unit:'',createdAt:todayISO()}}target.status=b.dataset.status;target.updatedAt=todayISO();await put('items',target);await syncAutoShopping();closeModal();toast(`${name}: ${statusLabel(target.status)}`);render()});
}

function openScanner(onFound){
  modal('Scan Barcode',`<div class="scanner-wrap"><video id="scannerVideo" playsinline muted></video><div class="scanner-status" id="scannerStatus">Minta akses kamera...</div></div><div class="note">Jika scanner tak disokong oleh browser, isi barcode secara manual dalam borang barang. PWA ini sengaja tiada CDN supaya kekal offline.</div>`);
  const video=$('#scannerVideo');const status=$('#scannerStatus');let stream=null;let stopped=false;
  const stop=()=>{stopped=true;if(stream)stream.getTracks().forEach(t=>t.stop())};window.__stopScanner=stop;
  (async()=>{
    if(!('BarcodeDetector' in window)){status.textContent='Browser ini belum support BarcodeDetector. Gunakan input barcode manual.';return}
    try{const formats=await BarcodeDetector.getSupportedFormats();const detector=new BarcodeDetector({formats:formats.filter(f=>['ean_13','ean_8','upc_a','upc_e','code_128'].includes(f))});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();status.textContent='Halakan kamera pada barcode...';
      const tick=async()=>{if(stopped)return;try{const codes=await detector.detect(video);if(codes.length){const code=codes[0].rawValue;stop();closeModal();onFound?.(code);return}}catch{}requestAnimationFrame(tick)};tick();
    }catch(err){status.textContent='Tak dapat buka kamera: '+err.message}
  })();
}

async function exportData(){
  const data={version:1,exportedAt:new Date().toISOString()};for(const s of STORE_NAMES)data[s]=await getAll(s);const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`DapurKu-backup-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup exported');
}
async function importData(e){
  const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());for(const s of STORE_NAMES){if(Array.isArray(data[s])){await clearStore(s);for(const x of data[s])await put(s,x)}}await put('settings',{id:'initialized',value:true});toast('Backup imported');render();}catch(err){alert('Fail import: '+err.message)}e.target.value='';
}
async function confirmReset(){if(!confirm('Padam SEMUA data DapurKu dalam device ini?'))return;for(const s of STORE_NAMES)await clearStore(s);await put('settings',{id:'initialized',value:true});await put('settings',{id:'demo',value:false});for(const r of seedRecipes)await put('recipes',r);toast('Data dipadam. Library resipi asas dikekalkan.');render()}
async function confirmStartBlank(){if(!confirm('Buang demo pantry & purchase history? Library resipi akan kekal.'))return;for(const s of ['items','shopping','history'])await clearStore(s);await put('settings',{id:'demo',value:false});toast('Demo dibuang. DapurKu sedia untuk data sebenar.');render()}

function wireNav(){$$('.nav-btn').forEach(b=>b.onclick=()=>switchView(b.dataset.view))}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')};
window.addEventListener('appinstalled',()=>toast('DapurKu installed'));

(async function init(){
  try{await openDB();await seedIfNeeded();wireNav();await render();if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});}catch(err){document.body.innerHTML=`<pre style="padding:20px">DapurKu gagal start:\n${escapeHtml(err.stack||err.message)}</pre>`}
})();
