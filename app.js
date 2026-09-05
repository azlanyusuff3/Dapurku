const DB_NAME='DapurKuDB';
const DB_VERSION=1;
const STORE_NAMES=['items','shopping','history','recipes','settings'];
let db;
let currentView='home';
let deferredPrompt=null;
let shoppingMode=false;
let shoppingSnapshot=null;

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
function put(store,val){return new Promise((res,rej)=>{const r=tx(store,'readwrite').put(val);r.onsuccess=()=>res(val);r.onerror=()=>rej(r.error)})}
function del(store,id){return new Promise((res,rej)=>{const r=tx(store,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearStore(store){return new Promise((res,rej)=>{const r=tx(store,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}

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
  ['Chicken','Fresh','Freezer','in',false,isoPlus(18),'',1,'pack'],['Coconut milk','Pantry','Pantry','low',true,isoPlus(90),'',1,'box'],
  ["Bird’s eye chilli",'Fresh','Fridge','out',true,isoPlus(5),'',1,'pack'],['Lemongrass','Fresh','Fridge','in',false,isoPlus(7),'',5,'stalks'],
  ['Salt','Pantry','Pantry','in',true,'','',1,'pack'],['Egg','Dairy','Fridge','low',true,isoPlus(9),'',8,'pcs'],['Milo','Drinks','Pantry','out',true,isoPlus(180),'9556001122334',1,'pack'],
  ['Cooking oil','Pantry','Pantry','low',true,isoPlus(120),'',1,'bottle'],['Onion','Fresh','Pantry','in',true,isoPlus(12),'',4,'pcs'],['Garlic','Fresh','Pantry','in',true,isoPlus(20),'',1,'bulb'],
  ['Ginger','Fresh','Fridge','in',false,isoPlus(12),'',1,'piece'],['Potato','Fresh','Pantry','in',false,isoPlus(15),'',5,'pcs'],['Fresh milk','Dairy','Fridge','in',true,isoPlus(2),'',1,'bottle'],
  ['Yogurt','Dairy','Fridge','in',false,isoPlus(4),'',2,'cups'],['Sweet soy sauce','Sauces','Pantry','in',true,isoPlus(200),'',1,'bottle'],['Fresh turmeric','Fresh','Fridge','in',false,isoPlus(10),'',1,'piece']
].map((x,i)=>({id:`i${i+1}`,name:x[0],category:x[1],location:x[2],status:x[3],favorite:x[4],expiry:x[5],barcode:x[6],qty:x[7],unit:x[8],createdAt:todayISO(),updatedAt:todayISO()}));
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
    if(item.status==='low'||item.status==='out'){
      if(!existing){const entry={id:uid(),itemId:item.id,name:item.name,category:item.category||'Other',qty:1,unit:item.unit||'',checked:false,source:'auto',reason:item.status,createdAt:new Date().toISOString()};await put('shopping',entry);shopping.push(entry)}
      else if(existing.reason!==item.status||existing.name!==item.name){existing.reason=item.status;existing.name=item.name;existing.category=item.category||existing.category;await put('shopping',existing)}
    }else if(existing){await del('shopping',existing.id);shopping=shopping.filter(s=>s.id!==existing.id)}
  }
}

function statusLabel(s){return s==='in'?'In stock':s==='low'?'Running low':'Out'}
function statusBadge(s){return `<span class="badge ${s==='in'?'badge-ok':s==='low'?'badge-low':'badge-out'}">${statusLabel(s)}</span>`}
function categoryIcon(cat=''){const c=cat.toLowerCase();if(c.includes('fresh'))return'🥬';if(c.includes('dairy'))return'🥛';if(c.includes('drink'))return'🥤';if(c.includes('sauce'))return'🫙';if(c.includes('house'))return'🧼';if(c.includes('frozen'))return'🧊';return'🥫'}
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
    ${exp.length?`<div class="use-first">${exp.slice(0,6).map(i=>`<div class="use-card"><span>${categoryIcon(i.category)}</span><div><b>${escapeHtml(i.name)}</b><small>${daysUntil(i.expiry)===0?'Expires today':daysUntil(i.expiry)===1?'Expires tomorrow':`${daysUntil(i.expiry)} days left`}</small></div><em>${fmtDate(i.expiry)}</em></div>`).join('')}</div>`:`<div class="empty-soft">✓ Nothing expires in the next 7 days.</div>`}
    <div class="section-head"><div><span class="section-kicker">SMART CHECK</span><h3>Likely running low</h3></div></div>
    ${predictions.length?`<div class="prediction-strip">${predictions.slice(0,4).map(p=>`<button class="prediction pred-check" data-name="${escapeHtml(p.name)}"><span>🧠</span><div><b>${escapeHtml(p.name)}</b><small>Usually every ~${p.avg} days · last bought ${p.daysSince} days ago</small></div><em>Check →</em></button>`).join('')}</div>`:`<div class="empty-soft">Prediction appears after DapurKu sees enough purchase history.</div>`}
  `;
  $$('[data-go]').forEach(x=>x.onclick=()=>switchView(x.dataset.go));$('#qaItem').onclick=()=>openItemForm();$('#qaShop').onclick=()=>openShoppingForm();$('#qaScan').onclick=()=>openScanner(code=>openItemForm(null,code));
  $$('.recipe-open').forEach(x=>x.onclick=()=>openRecipeDetail(x.dataset.id));$$('.pred-check').forEach(x=>x.onclick=()=>openPredictionCheck(x.dataset.name));if($('#startBlankBtn'))$('#startBlankBtn').onclick=confirmStartBlank;
}

function recipeTile(r,a){const label=a.ready?'Ready now':a.missing.length===0?'Use low stock':`${a.missing.length} item${a.missing.length===1?'':'s'} missing`;return `<button class="recipe-tile recipe-open" data-id="${r.id}"><div class="recipe-plate">${a.ready?'✨':a.expiryHits?'⏳':'🍽️'}</div><div class="recipe-tile-body"><small>${escapeHtml(r.category)}</small><b>${escapeHtml(recipeTitleLabel(r))}</b><div class="match-line"><span style="width:${a.score}%"></span></div><em>${a.score}% match · ${label}</em></div></button>`}

async function renderShop(){
  const shopping=(await getAll('shopping')).sort((a,b)=>Number(a.checked)-Number(b.checked)||(a.category||'').localeCompare(b.category||''));const groups={};shopping.forEach(s=>(groups[s.category||'Other']??=[]).push(s));const pending=shopping.filter(x=>!x.checked).length;
  $('#view-shop').innerHTML=`
    <div class="page-intro"><span class="page-icon">🛒</span><div><span class="section-kicker">SHOPPING</span><h2>${shoppingMode?'Shopping mode':'Your shopping list'}</h2><p>${shoppingMode?'Tick items as they go into the trolley. Finish to restock your pantry.':`${pending} item${pending===1?'':'s'} still to buy.`}</p></div></div>
    <div class="shop-actions">${shoppingMode?`<button class="btn btn-danger-soft" id="cancelShopBtn">✕ Cancel</button><button class="btn btn-primary" id="finishShopBtn">✓ Finish Shopping</button>`:`<button class="btn btn-secondary" id="addShopBtn">+ Add to Shopping List</button><button class="btn btn-primary" id="startShopBtn" ${shopping.length?'':'disabled'}>Start Shopping →</button>`}</div>
    ${shoppingMode?`<div class="shopping-banner"><span>🛍️</span><div><b>${shopping.filter(x=>x.checked).length} picked</b><small>${shopping.filter(x=>!x.checked).length} remaining</small></div><div class="shopping-progress"><i style="width:${shopping.length?Math.round(shopping.filter(x=>x.checked).length/shopping.length*100):0}%"></i></div></div>`:''}
    <div class="${shoppingMode?'shopping-mode':''}">${shopping.length?Object.entries(groups).map(([cat,arr])=>`<section class="shop-group"><h4>${escapeHtml(cat)}</h4>${arr.map(s=>`<div class="shop-item ${s.checked?'done':''}"><input class="shop-check" data-id="${s.id}" type="checkbox" ${s.checked?'checked':''}><div class="row-main"><div class="row-title">${escapeHtml(s.name)} ${s.qty&&s.qty!==1?`×${s.qty}`:''}</div><div class="row-sub">${s.source==='auto'?(s.reason==='out'?'Auto · Out of stock':'Auto · Running low'):s.source==='recipe'?'From recipe':'Manual'}${s.unit?` · ${escapeHtml(s.unit)}`:''}</div></div>${!shoppingMode&&s.source!=='auto'?`<button class="mini-btn shop-delete" data-id="${s.id}" aria-label="Delete">🗑️</button>`:''}</div>`).join('')}</section>`).join(''):`<div class="empty"><div class="big">🛒</div><b>Your list is empty.</b><br>Pantry items marked <b>Running low</b> or <b>Out</b> appear here automatically.</div>`}</div>`;
  $$('.shop-check').forEach(c=>c.onchange=async()=>{const s=await getOne('shopping',c.dataset.id);s.checked=c.checked;await put('shopping',s);renderShop()});$$('.shop-delete').forEach(b=>b.onclick=async()=>{await del('shopping',b.dataset.id);toast('Removed from shopping list');render()});
  if($('#addShopBtn'))$('#addShopBtn').onclick=()=>openShoppingForm();if($('#startShopBtn'))$('#startShopBtn').onclick=startShopping;if($('#finishShopBtn'))$('#finishShopBtn').onclick=openFinishShopping;if($('#cancelShopBtn'))$('#cancelShopBtn').onclick=cancelShopping;
}

async function startShopping(){const all=await getAll('shopping');shoppingSnapshot=Object.fromEntries(all.map(s=>[s.id,!!s.checked]));shoppingMode=true;toast('Shopping mode started');renderShop()}
async function cancelShopping(){if(!confirm('Cancel this shopping session? Any ticks made after starting will be restored to their previous state.'))return;const all=await getAll('shopping');if(shoppingSnapshot){for(const s of all){if(Object.prototype.hasOwnProperty.call(shoppingSnapshot,s.id)){s.checked=shoppingSnapshot[s.id];await put('shopping',s)}}}shoppingMode=false;shoppingSnapshot=null;toast('Shopping session cancelled');renderShop()}

async function renderPantry(){
  const items=(await getAll('items')).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.name.localeCompare(b.name));
  $('#view-pantry').innerHTML=`<div class="page-intro"><span class="page-icon">🥫</span><div><span class="section-kicker">PANTRY</span><h2>What you have at home</h2><p>Keep it simple: In stock → Running low → Out.</p></div></div>
    <div class="toolbar"><input id="pantrySearch" placeholder="Search pantry..."><select id="pantryLocation"><option value="">All locations</option>${['Pantry','Fridge','Freezer','Kitchen','Household'].map(x=>`<option>${x}</option>`).join('')}</select></div>
    <div id="pantryList"></div><button class="fab" id="addPantryFab" aria-label="Add pantry item">＋</button>`;
  const draw=()=>{const q=normalizeName($('#pantrySearch').value),loc=$('#pantryLocation').value;const list=items.filter(i=>(!q||normalizeName(i.name).includes(q))&&(!loc||i.location===loc));$('#pantryList').innerHTML=list.length?`<div class="pantry-grid">${list.map(i=>`<article class="pantry-card"><button class="pantry-edit" data-id="${i.id}"><span class="pantry-icon">${categoryIcon(i.category)}</span><div><b>${escapeHtml(i.name)}</b><small>${escapeHtml(i.location)}${i.expiry?` · ${fmtDate(i.expiry)}`:''}</small></div>${i.favorite?'<em>★</em>':''}</button><div class="status-switch">${['in','low','out'].map(s=>`<button class="status-set ${i.status===s?'active '+s:''}" data-id="${i.id}" data-status="${s}">${s==='in'?'In':s==='low'?'Low':'Out'}</button>`).join('')}</div></article>`).join('')}</div>`:'<div class="empty">No pantry items found.</div>';$$('.pantry-edit').forEach(b=>b.onclick=()=>openItemForm(b.dataset.id));$$('.status-set').forEach(b=>b.onclick=async()=>{const i=await getOne('items',b.dataset.id);i.status=b.dataset.status;i.updatedAt=todayISO();await put('items',i);await syncAutoShopping();toast(`${i.name}: ${statusLabel(i.status)}`);render()})};
  $('#pantrySearch').addEventListener('input',draw);$('#pantryLocation').addEventListener('change',draw);$('#addPantryFab').onclick=()=>openItemForm();draw();
}

async function renderRecipes(){
  const [recipes,items]=await Promise.all([getAll('recipes'),getAll('items')]);const cats=[...new Set(recipes.map(r=>r.category))].sort();const assessments=recipes.map(r=>({r,a:recipeAssessment(r,items)}));
  const ready=assessments.filter(x=>x.a.ready).length,almost=assessments.filter(x=>x.a.missing.length<=2&&!x.a.ready).length;
  $('#view-recipes').innerHTML=`<div class="page-intro recipe-intro"><span class="page-icon">🍳</span><div><span class="section-kicker">RECIPE DISCOVERY</span><h2>What should I cook?</h2><p>DapurKu ranks meals using what is already in your kitchen.</p></div></div>
    <div class="recipe-summary"><div><strong>${ready}</strong><span>Ready now</span></div><div><strong>${almost}</strong><span>1–2 items away</span></div><div><strong>${recipes.length}</strong><span>Ideas</span></div></div>
    <div class="recipe-cta"><div><b>Feeling blank?</b><small>Let DapurKu pick one of your best pantry matches.</small></div><button class="btn btn-primary" id="surpriseRecipe">Pick for me ✦</button></div>
    <div class="recipe-tools"><input id="recipeSearch" placeholder="Search dish or ingredient..."><select id="recipeCategory"><option value="">All categories</option>${cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('')}</select><select id="recipeSort"><option value="best">Best pantry match</option><option value="ready">Ready now first</option><option value="expiry">Use expiring food</option><option value="quick">Quickest first</option></select></div>
    <div class="recipe-library-head"><span id="recipeCount"></span><button class="text-btn" id="addRecipeBtn">+ Add your recipe</button></div><div id="recipeList"></div>`;
  const draw=()=>{const q=normalizeName($('#recipeSearch').value),cat=$('#recipeCategory').value,sort=$('#recipeSort').value;let list=assessments.filter(({r})=>(!q||normalizeName(recipeTitleLabel(r)).includes(q)||r.ingredients.some(i=>normalizeName(recipeIngredientLabel(i.name)).includes(q)||normalizeName(i.name).includes(q)))&&(!cat||r.category===cat));
    if(sort==='ready')list.sort((x,y)=>Number(y.a.ready)-Number(x.a.ready)||y.a.rank-x.a.rank);else if(sort==='expiry')list.sort((x,y)=>y.a.expiryHits-x.a.expiryHits||y.a.rank-x.a.rank);else if(sort==='quick')list.sort((x,y)=>(x.r.time||999)-(y.r.time||999));else list.sort((x,y)=>y.a.rank-x.a.rank||recipeTitleLabel(x.r).localeCompare(recipeTitleLabel(y.r)));
    $('#recipeCount').textContent=`${list.length} recipe${list.length===1?'':'s'}`;$('#recipeList').innerHTML=list.length?`<div class="recipe-list">${list.map(({r,a})=>`<button class="recipe-row recipe-open" data-id="${r.id}"><div class="recipe-row-score"><strong>${a.score}</strong><small>% match</small></div><div class="recipe-row-main"><span>${escapeHtml(r.category)} · ${r.time||'-'} min</span><b>${escapeHtml(recipeTitleLabel(r))}</b><div class="chips">${a.ready?'<i class="chip ready">Ready now</i>':a.missing.length?`<i class="chip missing">${a.missing.length} missing</i>`:'<i class="chip low">Low stock</i>'}${a.expiryHits?`<i class="chip expiry">Uses ${a.expiryHits} expiring item${a.expiryHits>1?'s':''}</i>`:''}${r.sourceName==='Che Nom'?'<i class="chip source">Che Nom source</i>':''}</div></div><span class="recipe-arrow">›</span></button>`).join('')}</div>`:'<div class="empty">No recipes match your search.</div>';$$('.recipe-open').forEach(x=>x.onclick=()=>openRecipeDetail(x.dataset.id))};
  $('#recipeSearch').addEventListener('input',draw);$('#recipeCategory').addEventListener('change',draw);$('#recipeSort').addEventListener('change',draw);$('#addRecipeBtn').onclick=openRecipeForm;$('#surpriseRecipe').onclick=()=>{const top=assessments.sort((x,y)=>y.a.rank-x.a.rank).slice(0,Math.min(10,assessments.length));if(top.length)openRecipeDetail(top[Math.floor(Math.random()*top.length)].r.id)};draw();
}

async function renderMore(){
  const history=(await getAll('history')).sort((a,b)=>b.date.localeCompare(a.date));
  $('#view-more').innerHTML=`<div class="page-intro"><span class="page-icon">⋯</span><div><span class="section-kicker">MORE</span><h2>History & data</h2><p>Your pantry stays on this device unless you export a backup.</p></div></div>
    <div class="section-head"><div><h3>Purchase History</h3></div></div>${history.length?history.slice(0,20).map(h=>`<div class="history-card"><div class="history-head"><b>${fmtDate(h.date)}</b><strong>${h.total?`RM ${Number(h.total).toFixed(2)}`:'—'}</strong></div><small>${escapeHtml(h.store||'Store not recorded')}</small><div class="history-items">${h.items.map(i=>escapeHtml(i.name)+(i.qty&&i.qty!==1?` ×${i.qty}`:'')).join(' · ')}</div></div>`).join(''):'<div class="empty-soft">No purchase history yet.</div>'}
    <div class="section-head"><div><h3>Backup</h3><p>Useful before changing phone or clearing browser data.</p></div></div><div class="settings-row"><button class="btn btn-secondary" id="exportBtn">Export Backup</button><label class="btn btn-secondary file-btn">Import Backup<input type="file" id="importFile" accept="application/json"></label></div>
    <div class="section-head"><div><h3>About</h3></div></div><div class="note">DapurKu v2.1 · Offline-first PWA · IndexedDB · Smart shopping · expiry · purchase history · prediction · pantry-based recipe discovery.</div>
    <div class="danger-zone"><b>Reset local data</b><p>This deletes pantry, shopping and purchase history on this device. The built-in recipe library is restored.</p><button class="btn btn-danger-soft" id="resetBtn">Reset DapurKu</button></div>`;
  $('#exportBtn').onclick=exportData;$('#importFile').onchange=importData;$('#resetBtn').onclick=confirmReset;
}

function openItemForm(id=null,prefillBarcode=''){
  Promise.resolve(id?getOne('items',id):null).then(item=>{item=item||{name:'',category:'Pantry',location:'Pantry',status:'in',favorite:false,expiry:'',barcode:prefillBarcode,qty:1,unit:''};
    modal(id?'Edit Pantry Item':'Add Pantry Item',`<form id="itemForm"><div class="form-grid"><div class="field full"><label>Item name</label><input name="name" required value="${escapeHtml(item.name)}" placeholder="e.g. Coconut milk"></div><div class="field"><label>Category</label><select name="category">${['Pantry','Fresh','Dairy','Frozen','Drinks','Sauces','Household','Other'].map(x=>`<option ${item.category===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Location</label><select name="location">${['Pantry','Fridge','Freezer','Kitchen','Household'].map(x=>`<option ${item.location===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field full"><label>Stock status</label><select name="status"><option value="in" ${item.status==='in'?'selected':''}>In stock</option><option value="low" ${item.status==='low'?'selected':''}>Running low</option><option value="out" ${item.status==='out'?'selected':''}>Out</option></select></div><div class="field"><label>Quantity (optional)</label><input name="qty" type="number" min="0" step="any" value="${item.qty??1}"></div><div class="field"><label>Unit</label><input name="unit" value="${escapeHtml(item.unit||'')}" placeholder="pack / bottle / pcs"></div><div class="field"><label>Expiry date (optional)</label><input name="expiry" type="date" value="${item.expiry||''}"></div><div class="field"><label>Barcode (optional)</label><input name="barcode" value="${escapeHtml(item.barcode||'')}"></div><label class="check-row full"><input type="checkbox" name="favorite" ${item.favorite?'checked':''}> Always keep this stocked</label></div><div class="form-actions">${id?'<button class="btn btn-danger-soft" type="button" id="deleteItemBtn">Delete</button>':''}<button class="btn btn-primary" type="submit">Save Item</button></div></form>`);
    $('#itemForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const val={...item,id:id||uid(),name:f.get('name').trim(),category:f.get('category'),location:f.get('location'),status:f.get('status'),qty:Number(f.get('qty')||0),unit:f.get('unit').trim(),expiry:f.get('expiry'),barcode:f.get('barcode').trim(),favorite:f.get('favorite')==='on',createdAt:item.createdAt||todayISO(),updatedAt:todayISO()};await put('items',val);await syncAutoShopping();closeModal();toast(id?'Pantry item updated':'Pantry item added');render()};
    if(id)$('#deleteItemBtn').onclick=async()=>{if(confirm(`Delete ${item.name}?`)){await del('items',id);const shopping=await getAll('shopping');for(const s of shopping.filter(x=>x.itemId===id))await del('shopping',s.id);closeModal();render()}};
  });
}

function openShoppingForm(prefill=''){
  modal('Add to Shopping List',`<div class="note"><b>Shopping-only item:</b> use this for something you want to buy without maintaining stock/expiry. Use <b>Add Pantry Item</b> if you want DapurKu to track it at home.</div><form id="shopForm"><div class="form-grid"><div class="field full"><label>Item</label><input name="name" required value="${escapeHtml(prefill)}" placeholder="e.g. Kitchen towel"></div><div class="field"><label>Category</label><select name="category">${['Pantry','Fresh','Dairy','Frozen','Drinks','Sauces','Household','Recipe','Other'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Quantity</label><input name="qty" type="number" min="1" value="1"></div></div><div class="form-actions"><button class="btn btn-primary" type="submit">Add to List</button></div></form>`);
  $('#shopForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await put('shopping',{id:uid(),name:f.get('name').trim(),category:f.get('category'),qty:Number(f.get('qty')||1),checked:false,source:'manual',createdAt:new Date().toISOString()});closeModal();toast('Added to shopping list');render()};
}

async function openFinishShopping(){
  const all=await getAll('shopping'),checked=all.filter(x=>x.checked);if(!checked.length){toast('Tick at least one purchased item first');return}
  modal('Finish Shopping',`<form id="finishForm"><div class="field"><label>Store (optional)</label><input name="store" placeholder="Lotus / NSK / AEON"></div><div class="field"><label>Total spent RM (optional)</label><input name="total" type="number" min="0" step="0.01" placeholder="0.00"></div><div class="note">${checked.length} purchased item${checked.length===1?'':'s'} will be recorded in Purchase History and restocked as <b>In stock</b>.</div><div class="form-actions"><button class="btn btn-primary" type="submit">Finish & Restock</button></div></form>`);
  $('#finishForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),items=await getAll('items'),histItems=[];for(const s of checked){let item=s.itemId?items.find(i=>i.id===s.itemId):itemMatch(s.name,items);if(item){item.status='in';item.updatedAt=todayISO();item.lastPurchasedAt=todayISO();await put('items',item)}else{item={id:uid(),name:s.name,category:s.category||'Other',location:'Pantry',status:'in',favorite:false,expiry:'',barcode:'',qty:s.qty||1,unit:'',createdAt:todayISO(),updatedAt:todayISO(),lastPurchasedAt:todayISO()};await put('items',item)}histItems.push({name:s.name,qty:s.qty||1});await del('shopping',s.id)}await put('history',{id:uid(),date:todayISO(),store:f.get('store').trim(),total:Number(f.get('total')||0),items:histItems});shoppingMode=false;shoppingSnapshot=null;closeModal();await syncAutoShopping();toast('Shopping finished and pantry restocked');render()};
}

async function openRecipeDetail(id){
  const [r,items]=await Promise.all([getOne('recipes',id),getAll('items')]);if(!r)return;const a=recipeAssessment(r,items);
  modal(escapeHtml(recipeTitleLabel(r)),`<div class="recipe-detail-head"><div><span>${escapeHtml(r.category)} · ${r.time||'-'} min</span><strong>${a.score}% pantry match</strong></div>${a.ready?'<b class="ready-pill">Ready to cook</b>':`<b class="need-pill">${a.missing.length} missing</b>`}</div><div class="match-line large"><span style="width:${a.score}%"></span></div><div class="note">${escapeHtml(recipeNoteLabel(r))}</div><div class="ingredient-list">${a.details.map(d=>`<div class="ingredient ${d.state}"><span class="dot"></span><div class="row-main"><b>${escapeHtml(recipeIngredientLabel(d.name))}</b><div class="row-sub">${d.state==='have'?'In your pantry':d.state==='low'?'You have it, but stock is low':'Missing / out of stock'}${d.expiring?' · use soon':''}</div></div>${d.state==='have'?'<span class="badge badge-ok">Have</span>':d.state==='low'?'<span class="badge badge-low">Low</span>':'<span class="badge badge-out">Buy</span>'}</div>`).join('')}</div>
    ${a.missing.length||a.low?`<button class="btn btn-primary btn-block" id="addMissingBtn">🛒 Add missing / low ingredients</button>`:'<div class="empty-soft">✨ You already have the main ingredients.</div>'}
    ${r.sourceUrl?`<a class="btn btn-secondary btn-block source-link" href="${r.sourceUrl}" target="_blank" rel="noopener">Open ${escapeHtml(r.sourceName||'source')} recipe ↗</a>`:''}`);
  if($('#addMissingBtn'))$('#addMissingBtn').onclick=async()=>{const existing=await getAll('shopping');for(const d of a.details.filter(x=>x.state!=='have')){if(!existing.find(s=>normalizeName(s.name)===normalizeName(d.name)&&!s.checked))await put('shopping',{id:uid(),name:recipeIngredientLabel(d.name),category:'Recipe',qty:1,checked:false,source:'recipe',createdAt:new Date().toISOString()})}closeModal();toast('Ingredients added to shopping list');render()};
}

function openRecipeForm(){
  modal('Add Your Recipe',`<form id="recipeForm"><div class="field"><label>Recipe name</label><input name="title" required placeholder="e.g. Mum’s ikan sambal"></div><div class="field"><label>Category</label><input name="category" value="My Recipes"></div><div class="field"><label>Time (minutes)</label><input type="number" name="time" value="30"></div><div class="field"><label>Ingredients — one per line</label><textarea name="ingredients" required placeholder="ikan\ncili kering\nbawang merah\ngaram"></textarea></div><div class="field"><label>Source URL (optional)</label><input type="url" name="sourceUrl" placeholder="https://..."></div><div class="form-actions"><button class="btn btn-primary" type="submit">Save Recipe</button></div></form>`);
  $('#recipeForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),ingredients=f.get('ingredients').split(/\n|,/).map(s=>s.trim()).filter(Boolean).map(name=>({name}));await put('recipes',{id:uid(),title:f.get('title').trim(),category:f.get('category').trim()||'My Recipes',time:Number(f.get('time')||0),sourceName:f.get('sourceUrl')?'External source':'DapurKu',sourceUrl:f.get('sourceUrl').trim(),note:'Resipi anda sendiri.',ingredients});closeModal();toast('Recipe saved');render()};
}

async function buildPredictions(){const [history,items]=await Promise.all([getAll('history'),getAll('items')]);const by={};history.sort((a,b)=>a.date.localeCompare(b.date)).forEach(h=>h.items.forEach(it=>{const key=normalizeName(it.name);(by[key]??={name:it.name,dates:[]}).dates.push(h.date)}));const out=[];for(const k of Object.keys(by)){const d=by[k].dates;if(d.length<2)continue;const ints=[];for(let i=1;i<d.length;i++)ints.push(daysBetween(d[i-1],d[i]));const avg=Math.round(ints.reduce((a,b)=>a+b,0)/ints.length),last=d[d.length-1],ds=daysBetween(last,todayISO()),item=itemMatch(by[k].name,items);if(avg>0&&ds>=Math.max(3,Math.floor(avg*.78))&&(!item||item.status==='in'))out.push({name:by[k].name,avg,daysSince:ds,ratio:ds/avg})}return out.sort((a,b)=>b.ratio-a.ratio)}
async function openPredictionCheck(name){const items=await getAll('items'),item=itemMatch(name,items);modal(`Check ${escapeHtml(name)}`,`<div class="note">This prediction is only a reminder. DapurKu never changes stock automatically.</div><div class="prediction-choices"><button class="btn btn-secondary pred-set" data-status="in">✓ Still in stock</button><button class="btn btn-secondary pred-set" data-status="low">⚠ Running low</button><button class="btn btn-danger-soft pred-set" data-status="out">Out</button></div>`);$$('.pred-set').forEach(b=>b.onclick=async()=>{let target=item;if(!target)target={id:uid(),name,category:'Pantry',location:'Pantry',favorite:false,expiry:'',barcode:'',qty:1,unit:'',createdAt:todayISO()};target.status=b.dataset.status;target.updatedAt=todayISO();await put('items',target);await syncAutoShopping();closeModal();toast(`${name}: ${statusLabel(target.status)}`);render()})}

function openScanner(onFound){modal('Scan Barcode',`<div class="scanner-wrap"><video id="scannerVideo" playsinline muted></video><div class="scanner-status" id="scannerStatus">Requesting camera access...</div></div><div class="note">If your browser does not support barcode detection, enter the barcode manually in Add Pantry Item. No external scanner library is loaded, so the PWA remains offline-friendly.</div>`);const video=$('#scannerVideo'),status=$('#scannerStatus');let stream=null,stopped=false;const stop=()=>{stopped=true;if(stream)stream.getTracks().forEach(t=>t.stop())};window.__stopScanner=stop;(async()=>{if(!('BarcodeDetector'in window)){status.textContent='BarcodeDetector is not supported in this browser. Use manual barcode entry.';return}try{const formats=await BarcodeDetector.getSupportedFormats(),detector=new BarcodeDetector({formats:formats.filter(f=>['ean_13','ean_8','upc_a','upc_e','code_128'].includes(f))});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();status.textContent='Point the camera at a barcode...';const tick=async()=>{if(stopped)return;try{const codes=await detector.detect(video);if(codes.length){const code=codes[0].rawValue;stop();closeModal();onFound?.(code);return}}catch{}requestAnimationFrame(tick)};tick()}catch(err){status.textContent='Could not open camera: '+err.message}})()}

async function exportData(){const data={version:2,exportedAt:new Date().toISOString()};for(const s of STORE_NAMES)data[s]=await getAll(s);const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`DapurKu-backup-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup exported')}
async function importData(e){const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());for(const s of STORE_NAMES){if(Array.isArray(data[s])){await clearStore(s);for(const x of data[s])await put(s,x)}}await put('settings',{id:'initialized',value:true});await ensureRecipeLibrary();toast('Backup imported');render()}catch(err){alert('Import failed: '+err.message)}e.target.value=''}
async function confirmReset(){if(!confirm('Delete ALL DapurKu data stored on this device?'))return;for(const s of STORE_NAMES)await clearStore(s);await put('settings',{id:'initialized',value:true});await put('settings',{id:'demo',value:false});await ensureRecipeLibrary();toast('Local data cleared. Built-in recipe library restored.');render()}
async function confirmStartBlank(){if(!confirm('Remove the demo pantry and purchase history? The recipe library will stay.'))return;for(const s of ['items','shopping','history'])await clearStore(s);await put('settings',{id:'demo',value:false});toast('Demo data removed. Your kitchen is ready.');render()}
function wireNav(){$$('.nav-btn').forEach(b=>b.onclick=()=>switchView(b.dataset.view))}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')};window.addEventListener('appinstalled',()=>toast('DapurKu installed'));
(async function init(){try{await openDB();await seedIfNeeded();wireNav();await render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}catch(err){document.body.innerHTML=`<pre style="padding:20px">DapurKu could not start:\n${escapeHtml(err.stack||err.message)}</pre>`}})();
