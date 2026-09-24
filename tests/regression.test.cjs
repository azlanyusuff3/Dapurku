const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.js'), 'utf8');
const section = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
const execute = (code, context) => vm.runInNewContext(code, context);
const pause = () => new Promise(resolve => setTimeout(resolve, 20));

test('a second tick during an in-flight upload is still uploaded', async () => {
  const storage = new Map([['dapurkuBoundHousehold', 'home']]);
  const localStorage = {getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  const sent=[];
  let finishFirst;
  const firstUpload = new Promise(resolve => {finishFirst=resolve});
  const context = {
    localStorage,activeHousehold:{id:'home'},cloudUser:{id:'user'},navigator:{onLine:true},
    cloudFlushPromise:null,cloudBusy:false,cloudPullBusy:false,cloudStatus:'',
    suppressCloudSync:false,pauseCloudFlush:false,setTimeout,scheduleRender:()=>{},console,
    uid:(()=>{let id=0;return()=>String(++id)})(),syncableRecord:()=>true,
    cloudClient:{from:()=>({upsert:async rows=>{sent.push(rows.map(row=>({...row})));if(sent.length===1)await firstUpload;return {error:null}}})}
  };
  execute(section('function readSyncQueue()', 'async function put(')+section('async function flushSyncQueue()', 'async function cloudSignIn('), context);
  execute("queueCloudRecord('shopping','milk',{id:'milk',checked:true})",context);
  await pause();
  execute("queueCloudRecord('shopping','milk',{id:'milk',checked:false})",context);
  finishFirst();
  await pause();
  assert.equal(sent.length,2);
  assert.equal(sent[0][0].payload.checked,true);
  assert.equal(sent[1][0].payload.checked,false);
  assert.deepEqual(JSON.parse(storage.get('dapurkuSyncQueue')),[]);
});

test('opening a new empty kitchen does not upload the previous kitchen locally', async () => {
  const storage = new Map();let replaced=false;
  const context={
    cloudClient:{from:()=>({select:()=>({eq:async()=>({data:[],error:null})})})},
    cloudUser:{id:'user'},cloudHouseholds:[{id:'new',name:'New'}],activeHousehold:null,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    getOne:async()=>({value:'old'}),readSyncQueue:()=>[],unsubscribeCloud:()=>{},scheduleRender:()=>{},
    flushSyncQueue:async()=>true,uploadLocalSnapshot:async()=>{throw Error('previous kitchen uploaded')},
    replaceLocalFromCloud:async rows=>{assert.equal(rows.length,0);replaced=true},
    putRaw:async()=>{},subscribeCloud:()=>{},getCloudMembers:async()=>[],toast:()=>{},
    navigator:{onLine:true},cloudRecordTimes:new Map(),lastCloudPullAt:0,cloudStatus:'',Date,Map
  };
  execute(section('async function activateHousehold(', 'async function resumeCloudSync('),context);
  await vm.runInNewContext("activateHousehold('new')",context);
  assert.equal(replaced,true);
  assert.equal(storage.get('dapurkuBoundHousehold'),'new');
});

test('manual purchases create a pantry item and one history record', async () => {
  const data={items:[],shopping:[{id:'shop1',name:'Rice',category:'Barang Kering',qty:2,checked:true,source:'manual'}],history:[]};
  const form={onsubmit:null,querySelector:()=>({disabled:false})};
  const context={
    getAll:async store=>structuredClone(data[store]),
    put:async(store,val)=>{const i=data[store].findIndex(x=>x.id===val.id);if(i<0)data[store].push(structuredClone(val));else data[store][i]=structuredClone(val)},
    del:async(store,id)=>{data[store]=data[store].filter(x=>x.id!==id)},
    modal:()=>{},$:(selector)=>selector==='#finishForm'?form:null,
    FormData:class{get(key){return {purchaseDate:'2026-09-24',store:'Market',total:'10'}[key]||''}},
    todayISO:()=> '2026-09-24',uid:(()=>{let i=0;return()=>String(++i)})(),
    itemMatch:(name,items)=>items.find(x=>x.name.toLowerCase()===name.toLowerCase())||null,
    categoryForName:()=> 'Barang Kering',categoryLabel:x=>x,autoItemIcon:()=> '🛍️',
    shoppingMode:true,shoppingSnapshot:{},closeModal:()=>{},syncAutoShopping:async()=>{},
    toast:()=>{},fmtDate:x=>x,render:()=>{},console
  };
  execute(section('async function openFinishShopping()', 'async function openRecipeDetail('),context);
  await vm.runInNewContext('openFinishShopping()',context);
  await form.onsubmit({preventDefault:()=>{},target:form});
  assert.equal(data.items.length,1);
  assert.equal(data.items[0].status,'in');
  assert.equal(data.items[0].lastPurchasedAt,'2026-09-24');
  assert.equal(data.shopping.length,0);
  assert.equal(data.history.length,1);
});

test('item matching never treats coconut milk as milk', () => {
  const context={normalizeName:name=>name.toLowerCase()};
  execute(section('function itemMatch(', 'function recipeAssessment('),context);
  const result=vm.runInNewContext("itemMatch('milk',[{name:'Coconut milk'},{name:'Fresh milk'}])",context);
  assert.equal(result,null);
});

test('local purchase date uses Malaysia date at 00:30', () => {
  const context={Date};
  execute(section('const localDateISO=', 'const fmtDate='),context);
  // This UTC instant is already the next calendar day in Malaysia.
  const malaysia=new Date('2026-09-23T16:30:00Z');
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(malaysia);
  assert.equal(parts,'2026-09-24');
  const local=execute("localDateISO({getFullYear:()=>2026,getMonth:()=>8,getDate:()=>24})",context);
  assert.equal(local,'2026-09-24');
});

test('auto shopping cleans duplicate and orphaned entries', async () => {
  const data={items:[{id:'pantry1',name:'Egg',category:'Tenusu',status:'low'}],shopping:[
    {id:'auto1',itemId:'pantry1',name:'Egg',source:'auto',reason:'low'},
    {id:'auto2',itemId:'pantry1',name:'Egg',source:'auto',reason:'low'},
    {id:'orphan',itemId:'missing',name:'Rice',source:'auto'}
  ]};
  const context={
    autoShoppingPromise:null,getAll:async store=>structuredClone(data[store]),
    del:async(store,id)=>{data[store]=data[store].filter(x=>x.id!==id)},
    put:async()=>{throw Error('unexpected new auto entry')}
  };
  execute(section('async function syncAutoShopping()', 'function statusLabel('),context);
  await vm.runInNewContext('syncAutoShopping()',context);
  assert.deepEqual(data.shopping.map(x=>x.id),['auto1']);
});

test('backup import queues deletions as well as replacement records', async () => {
  const data={items:[{id:'old',name:'Old'}],shopping:[],history:[],recipes:[],settings:[{id:'cloudBinding',value:'home'}]};
  const changes=[];
  const backup={items:[{id:'new',name:'New'}],shopping:[],history:[],recipes:[],settings:[]};
  const context={
    STORE_NAMES:['items','shopping','history','recipes','settings'],SYNC_STORES:['items','shopping','history','recipes'],
    activeHousehold:{id:'home'},pauseCloudFlush:false,suppressCloudSync:false,
    getAll:async store=>structuredClone(data[store]),getOne:async()=>({value:'home'}),
    clearStore:async store=>{data[store]=[]},putRaw:async(store,val)=>{data[store].push(structuredClone(val))},
    ensureRecipeLibrary:async()=>{},syncableRecord:(store,val)=>store!=='recipes'||!/^r\d+$/.test(val.id),
    queueCloudRecord:(store,id,val,deleted)=>changes.push({store,id,deleted}),
    flushSyncQueue:async()=>true,toast:()=>{},render:()=>{},alert:msg=>{throw Error(msg)}
  };
  execute(section('async function importData(', 'async function confirmReset('),context);
  const event={target:{files:[{text:async()=>JSON.stringify(backup)}],value:'backup.json'}};
  await vm.runInNewContext('importData(event)',{...context,event});
  assert.equal(data.items[0].id,'new');
  assert.ok(changes.some(x=>x.store==='items'&&x.id==='old'&&x.deleted));
  assert.ok(changes.some(x=>x.store==='items'&&x.id==='new'&&!x.deleted));
});

test('cloud pull preserves a locally queued tick', async () => {
  const data={items:[],shopping:[{id:'egg',checked:true}],history:[],recipes:[]};
  const context={
    activeHousehold:{id:'home'},
    getAll:async store=>structuredClone(data[store]),
    clearStore:async store=>{data[store]=[]},
    delRaw:async(store,id)=>{data[store]=data[store].filter(x=>x.id!==id)},
    putRaw:async(store,val)=>{const index=data[store].findIndex(x=>x.id===val.id);if(index<0)data[store].push(structuredClone(val));else data[store][index]=structuredClone(val)},
    ensureRecipeLibrary:async()=>{},syncableRecord:()=>true,
    readSyncQueue:()=>[{householdId:'home',store:'shopping',id:'egg',payload:{id:'egg',checked:true},isDeleted:false}]
  };
  execute(section('async function replaceLocalFromCloud(', 'function subscribeCloud('),context);
  await vm.runInNewContext("replaceLocalFromCloud([{store:'shopping',record_id:'egg',payload:{id:'egg',checked:false},is_deleted:false}])",context);
  assert.equal(data.shopping[0].checked,true);
});
