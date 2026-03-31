import { useState, useEffect, useRef, useMemo } from "react";

// ─── YOUR TMDB READ ACCESS TOKEN ─────────────────────────────────────────────
// Paste your token from themoviedb.org → Settings → API → Read Access Token
const TMDB_TOKEN = "eуJhbGciOіJIUzl1NiJ9.eyJhdWQiOil0МWY0OТFmZjJkМzАхNWЕ2ZТFiZТg4NТМzZWFhYjYzNyIslm5iZіl6МТc3NDkwМТQ1NС4×МТМ5ОТk4LCJzdWliOil2О
WNhZDhjZWFkYzEyYzdjMmUyNjNiODYіLCJzY29wZXМiОlsiYХBpХ3JІYWQiXSwidmVyс2lvbil6МХ0.7K2gqHА1Sb64ljxtQi6DvG4Brjr_kАa3fJwV4oG_p78";

// ─── Global Styles ────────────────────────────────────────────────────────────
function useGlobalStyles() {
  useEffect(() => {
    if (document.getElementById('ms-styles')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap';
    document.head.appendChild(link);
    const s = document.createElement('style');
    s.id = 'ms-styles';
    s.textContent = `
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#F4EEE4}
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#C8B89A;border-radius:3px}
      .card-hover{cursor:pointer;transition:transform 0.15s,box-shadow 0.15s}
      .card-hover:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(0,0,0,0.14) !important}
      .tab-btn{transition:color 0.12s,border-color 0.12s;white-space:nowrap}
      .tab-btn:hover{color:#B8741A !important}
      .ghost-btn{transition:all 0.12s}
      .ghost-btn:hover{background:rgba(184,116,26,0.1) !important;border-color:#B8741A !important;color:#B8741A !important}
      .pill-btn{transition:all 0.12s;cursor:pointer}
      .pill-btn:hover{border-color:#B8741A !important;color:#B8741A !important}
      .status-cycle{cursor:pointer;transition:opacity 0.1s}
      .status-cycle:hover{opacity:0.65}
      input:focus,textarea:focus,select:focus{outline:none;border-color:#B8741A !important;box-shadow:0 0 0 3px rgba(184,116,26,0.12)}
      @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      .fade-up{animation:fadeUp 0.16s ease both}
      @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .shimmer{background:linear-gradient(90deg,#E8E0D0 25%,#F0E8DA 50%,#E8E0D0 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
      @keyframes modalIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
      .modal-in{animation:modalIn 0.14s ease}
      .accordion-hd{cursor:pointer;user-select:none;transition:background 0.12s}
      .accordion-hd:hover{background:rgba(184,116,26,0.06) !important}
      .del-btn:hover{background:rgba(200,60,60,0.15) !important;color:#C03030 !important;border-color:rgba(200,60,60,0.35) !important}
    `;
    document.head.appendChild(s);
  }, []);
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ; }
    else if (c === ',' && !inQ){out.push(cur);cur='';}
    else cur+=c;
  }
  out.push(cur); return out;
}
function parseCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
  if (lines.length < 2) return [];
  const hdrs = parseCSVLine(lines[0]).map(h=>h.trim());
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line); const obj = {};
    hdrs.forEach((h,i)=>{obj[h]=(cols[i]||'').trim();}); return obj;
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_MAP = {'Book':'Books','Audiobook':'Audiobooks','TV Show':'TV Shows','Movie':'Movies','Video Game':'Games','Podcast':'Podcasts'};
const MEDIA_TABS = ['Books','Audiobooks','TV Shows','Movies','Games','Podcasts'];
const TABS = ['Activity Log',...MEDIA_TABS];
const TAB_ICON = {'Activity Log':'📋',Books:'📖',Audiobooks:'🎧','TV Shows':'📺',Movies:'🎬',Games:'🎮',Podcasts:'🎙️'};
const CAT_CLR = {Books:'#8B5CF6',Audiobooks:'#3B82F6','TV Shows':'#EF4444',Movies:'#F59E0B',Games:'#10B981',Podcasts:'#F97316',Other:'#9CA3AF'};
const CAT_BG  = {Books:'#F3F0FF',Audiobooks:'#EFF6FF','TV Shows':'#FFF5F5',Movies:'#FFFBEB',Games:'#ECFDF5',Podcasts:'#FFF7ED',Other:'#F9FAFB'};
const STATUSES = [
  {id:'want',        label:'Want',        bg:'#EFF6FF', text:'#2563EB', bdr:'#BFDBFE'},
  {id:'in-progress', label:'In Progress', bg:'#FFFBEB', text:'#B45309', bdr:'#FDE68A'},
  {id:'finished',    label:'Finished',    bg:'#F0FDF4', text:'#15803D', bdr:'#BBF7D0'},
];
const ST = Object.fromEntries(STATUSES.map(s=>[s.id,s]));
const STATUS_CYCLE = {want:'in-progress','in-progress':'finished',finished:'want'};
const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const countStars = s => (s.match(/⭐/g)||[]).length;
const genId = () => 'i'+Date.now()+Math.random().toString(36).slice(2,6);
function parseSofaDate(str) {
  if(!str)return 0; const p=str.split('/'); if(p.length!==3)return 0;
  const[m,d,y]=p.map(Number); return new Date(y<100?2000+y:y,m-1,d).getTime();
}
function cleanTitle(s){return(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');}
function toItem(raw) {
  const list=raw['List Name']||'';
  const sr=(raw['Status']||'').toLowerCase();
  const status=sr.includes('progress')?'in-progress':sr.includes('finish')||sr==='done'||sr==='completed'?'finished':list==='Activity'?'finished':'want';
  return {
    id:genId(), title:cleanTitle(raw['Item Title']), list,
    category:CAT_MAP[raw['Category']]||raw['Category']||'Other',
    dateAdded:raw['Date Added']||'',
    pinned:(raw['Pinned']||'').toLowerCase()==='true',
    rating:countStars(raw['Rating']||''),
    recBy:raw['Recommended By']||'', status, notes:raw['Notes']||'',
  };
}

// ─── Image Fetch Queue ────────────────────────────────────────────────────────
const _q={q:[],running:false};
function enqueue(fn){return new Promise(resolve=>{_q.q.push({fn,resolve});if(!_q.running)_processQueue();});}
async function _processQueue(){
  if(_q.q.length===0){_q.running=false;return;}_q.running=true;
  const{fn,resolve}=_q.q.shift();
  try{resolve(await fn());}catch{resolve(null);}
  await new Promise(r=>setTimeout(r,80));_processQueue();
}
async function fetchCoverArt(title,category){
  if(!title)return null; const enc=encodeURIComponent(title);
  try{
    if(category==='Movies'){
      if(TMDB_TOKEN&&!TMDB_TOKEN.startsWith('YOUR_')){
        const r=await fetch(`https://api.themoviedb.org/3/search/movie?query=${enc}&language=en-US&page=1`,{headers:{Authorization:`Bearer ${TMDB_TOKEN}`}});
        const d=await r.json(); const p=d.results?.[0]?.poster_path; if(p)return TMDB_IMG+p;
      }
      const r2=await fetch(`https://itunes.apple.com/search?term=${enc}&media=movie&limit=1`);
      const d2=await r2.json(); return d2.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb')||null;
    }
    if(category==='TV Shows'){
      if(TMDB_TOKEN&&!TMDB_TOKEN.startsWith('YOUR_')){
        const r=await fetch(`https://api.themoviedb.org/3/search/tv?query=${enc}&language=en-US&page=1`,{headers:{Authorization:`Bearer ${TMDB_TOKEN}`}});
        const d=await r.json(); const p=d.results?.[0]?.poster_path; if(p)return TMDB_IMG+p;
      }
      const r2=await fetch(`https://itunes.apple.com/search?term=${enc}&media=tvShow&limit=1`);
      const d2=await r2.json(); return d2.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb')||null;
    }
    if(category==='Books'){
      const r=await fetch(`https://openlibrary.org/search.json?title=${enc}&limit=1&fields=cover_i`);
      const d=await r.json(); const covId=d.docs?.[0]?.cover_i;
      if(covId)return`https://covers.openlibrary.org/b/id/${covId}-M.jpg`;
      const r2=await fetch(`https://itunes.apple.com/search?term=${enc}&media=ebook&limit=1`);
      const d2=await r2.json(); return d2.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb')||null;
    }
    if(category==='Audiobooks'){
      const r=await fetch(`https://itunes.apple.com/search?term=${enc}&media=audiobook&limit=1`);
      const d=await r.json(); const img=d.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb');
      if(img)return img;
      const r2=await fetch(`https://openlibrary.org/search.json?title=${enc}&limit=1&fields=cover_i`);
      const d2=await r2.json(); const cid=d2.docs?.[0]?.cover_i;
      return cid?`https://covers.openlibrary.org/b/id/${cid}-M.jpg`:null;
    }
    if(category==='Podcasts'){const r=await fetch(`https://itunes.apple.com/search?term=${enc}&media=podcast&limit=1`);const d=await r.json();return d.results?.[0]?.artworkUrl100?.replace('100x100bb','600x600bb')||null;}
    if(category==='Games'){const r=await fetch(`https://itunes.apple.com/search?term=${enc}&entity=game&limit=1`);const d=await r.json();return d.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb')||null;}
  }catch{}return null;
}

// ─── Image Cache ──────────────────────────────────────────────────────────────
const IMG_CACHE_KEY='mySofa_imgCache_v1';
function loadImgCache(){try{return JSON.parse(localStorage.getItem(IMG_CACHE_KEY)||'{}');}catch{return{};}}
function saveImgCache(c){try{localStorage.setItem(IMG_CACHE_KEY,JSON.stringify(c));}catch{}}
let _imgCache=loadImgCache();

function useCoverArt(title,category){
  const key=`${category}::${title}`;
  const cached=_imgCache[key];
  const[url,setUrl]=useState(cached!==undefined?cached:undefined);
  const[loading,setLoading]=useState(cached===undefined);
  useEffect(()=>{
    if(!title||url!==undefined)return; let cancelled=false; setLoading(true);
    enqueue(()=>fetchCoverArt(title,category)).then(result=>{
      if(cancelled)return; _imgCache[key]=result||null; saveImgCache(_imgCache); setUrl(result||null); setLoading(false);
    });
    return()=>{cancelled=true;};
  },[title,category,key]);
  return{url,loading};
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Stars({n,size=12}){
  if(!n)return null;
  return<span style={{color:'#B8741A',fontSize:size,letterSpacing:-0.5,lineHeight:1}}>{'★'.repeat(n)}{'☆'.repeat(5-n)}</span>;
}
function StarPicker({value,onChange}){
  const[h,setH]=useState(0);
  return(
    <div style={{display:'flex',gap:4}}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onClick={()=>onChange(n===value?0:n)} onMouseEnter={()=>setH(n)} onMouseLeave={()=>setH(0)}
          style={{fontSize:26,color:n<=(h||value)?'#B8741A':'#D4C4A8',cursor:'pointer',transition:'color 0.1s,transform 0.1s',transform:n<=(h||value)?'scale(1.1)':'scale(1)'}}>★</span>
      ))}
    </div>
  );
}
function Badge({status,onClick,sm}){
  const s=ST[status]||ST.want;
  return(
    <span onClick={onClick} className={onClick?'status-cycle':''}
      style={{background:s.bg,color:s.text,border:`1px solid ${s.bdr}`,borderRadius:20,padding:sm?'2px 8px':'3px 10px',fontSize:sm?11:12,fontWeight:600,cursor:onClick?'pointer':'default',userSelect:'none',whiteSpace:'nowrap'}}>
      {s.label}
    </span>
  );
}
function CoverPlaceholder({category,title}){
  const clr=CAT_CLR[category]||'#888'; const bg=CAT_BG[category]||'#F5F5F5';
  return(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,background:bg}}>
      <span style={{fontSize:30,opacity:0.4}}>{TAB_ICON[category]||'◈'}</span>
      <div style={{fontSize:11,color:clr,fontWeight:600,textAlign:'center',padding:'0 8px',lineHeight:1.35,opacity:0.7,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>{title}</div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({item,onClick,onStatusChange}){
  const{url,loading}=useCoverArt(item.title,item.category);
  const[imgErr,setImgErr]=useState(false);
  const showPlaceholder=!loading&&(!url||imgErr);
  return(
    <div className="card-hover fade-up" onClick={()=>onClick(item)}
      style={{background:'#FFFFFF',border:'1px solid #E8DFCE',borderRadius:12,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
      <div style={{position:'relative',width:'100%',paddingTop:'148%',background:'#F0EAE0',flexShrink:0}}>
        <div style={{position:'absolute',inset:0}}>
          {loading&&<div className="shimmer" style={{width:'100%',height:'100%'}}/>}
          {showPlaceholder&&<CoverPlaceholder category={item.category} title={item.title}/>}
          {!loading&&url&&!imgErr&&<img src={url} alt={item.title} onError={()=>setImgErr(true)} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>}
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:'50%',background:'linear-gradient(to top,rgba(255,252,246,0.96) 0%,rgba(255,252,246,0.5) 55%,transparent 100%)',pointerEvents:'none'}}/>
          {item.pinned&&<div style={{position:'absolute',top:7,right:8,fontSize:12,color:'#B8741A'}}>⊞</div>}
          <div style={{position:'absolute',bottom:8,left:8}}>
            <Badge status={item.status} sm onClick={e=>{e.stopPropagation();onStatusChange(item.id,STATUS_CYCLE[item.status]);}}/>
          </div>
          {item.rating>0&&<div style={{position:'absolute',bottom:9,right:8}}><Stars n={item.rating} size={11}/></div>}
        </div>
      </div>
      <div style={{padding:'9px 10px 11px',display:'flex',flexDirection:'column',gap:3}}>
        <div style={{fontSize:13,fontWeight:600,color:'#1E1810',lineHeight:1.35,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{item.title}</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
          <span style={{fontSize:11,color:'#9A8E7A',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'70%'}}>
            {item.list&&item.list!=='Activity'?item.list:''}
          </span>
          <div style={{display:'flex',gap:5,alignItems:'center',flexShrink:0}}>
            {item.recBy&&<span title={`Rec'd by ${item.recBy}`} style={{fontSize:11,color:'#B8A898'}}>👤</span>}
            {item.notes&&<span title={item.notes} style={{fontSize:11,color:'#B8A898'}}>✎</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card Grid ────────────────────────────────────────────────────────────────
function CardGrid({items,onItemClick,onStatusChange}){
  if(!items.length)return null;
  return(
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))',gap:10}}>
      {items.map(item=><Card key={item.id} item={item} onClick={onItemClick} onStatusChange={onStatusChange}/>)}
    </div>
  );
}

// ─── Accordion Group ──────────────────────────────────────────────────────────
function AccordionGroup({title,items,onItemClick,onStatusChange,defaultOpen=false}){
  const[open,setOpen]=useState(defaultOpen);
  const clr = items[0] ? CAT_CLR[items[0].category]||'#888' : '#888';
  return(
    <div style={{border:'1px solid #E0D5C5',borderRadius:12,overflow:'hidden',marginBottom:10}}>
      <div className="accordion-hd" onClick={()=>setOpen(o=>!o)}
        style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',background:open?'rgba(184,116,26,0.04)':'#FDFAF5'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:14,fontWeight:700,color:'#2A1E10'}}>{title}</span>
          <span style={{fontSize:12,color:'#B8741A',background:'rgba(184,116,26,0.1)',borderRadius:10,padding:'1px 8px',fontWeight:600}}>{items.length}</span>
        </div>
        <span style={{fontSize:16,color:'#9A8068',transition:'transform 0.2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>⌄</span>
      </div>
      {open&&(
        <div style={{padding:'12px 12px 14px',background:'#FDFBF7',borderTop:'1px solid #EDE5D5'}}>
          <CardGrid items={items} onItemClick={onItemClick} onStatusChange={onStatusChange}/>
        </div>
      )}
    </div>
  );
}

// ─── Category View ────────────────────────────────────────────────────────────
function CategoryView({items,category,search,onItemClick,onStatusChange}){
  const catItems=useMemo(()=>{
    const base=items.filter(i=>i.category===category&&i.status!=='finished');
    if(!search)return base;
    return base.filter(i=>i.title.toLowerCase().includes(search.toLowerCase()));
  },[items,category,search]);

  const inProgress=useMemo(()=>catItems.filter(i=>i.status==='in-progress').sort((a,b)=>parseSofaDate(b.dateAdded)-parseSofaDate(a.dateAdded)),[catItems]);

  const groups=useMemo(()=>{
    const wantItems=catItems.filter(i=>i.status==='want');
    const g={};
    wantItems.forEach(item=>{const k=item.list&&item.list!=='Activity'?item.list:'Uncategorized';if(!g[k])g[k]=[];g[k].push(item);});
    // sort each group by pinned then date
    Object.values(g).forEach(arr=>arr.sort((a,b)=>{if(a.pinned!==b.pinned)return a.pinned?-1:1;return parseSofaDate(b.dateAdded)-parseSofaDate(a.dateAdded);}));
    return g;
  },[catItems]);

  const hasContent=inProgress.length>0||Object.keys(groups).length>0;

  if(!hasContent){
    return(
      <div style={{textAlign:'center',padding:'60px 20px',color:'#A09080'}}>
        <div style={{fontSize:32,marginBottom:10,opacity:0.4}}>{TAB_ICON[category]}</div>
        <div style={{fontSize:14}}>{search?`No ${category.toLowerCase()} matching "${search}"`:`No ${category.toLowerCase()} on your list yet`}</div>
      </div>
    );
  }

  return(
    <div>
      {/* In Progress */}
      {inProgress.length>0&&(
        <div style={{marginBottom:22}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:700,color:'#B45309',letterSpacing:0.3,textTransform:'uppercase'}}>In Progress</span>
            <span style={{fontSize:12,color:'#B8741A',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:10,padding:'1px 8px',fontWeight:600}}>{inProgress.length}</span>
          </div>
          <CardGrid items={inProgress} onItemClick={onItemClick} onStatusChange={onStatusChange}/>
        </div>
      )}
      {/* Want — grouped by list */}
      {Object.keys(groups).length>0&&(
        <div>
          {inProgress.length>0&&(
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <span style={{fontSize:13,fontWeight:700,color:'#4A3C2A',letterSpacing:0.3,textTransform:'uppercase'}}>Want to {category==='Books'||category==='Audiobooks'?'Read':category==='Games'?'Play':'Watch'}</span>
              <span style={{fontSize:12,color:'#7A6E5A',background:'#F0E8D8',borderRadius:10,padding:'1px 8px',fontWeight:600}}>
                {Object.values(groups).reduce((sum,arr)=>sum+arr.length,0)}
              </span>
            </div>
          )}
          {Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([listName,listItems])=>(
            <AccordionGroup key={listName} title={listName} items={listItems} onItemClick={onItemClick} onStatusChange={onStatusChange}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity Log View ────────────────────────────────────────────────────────
function ActivityLogView({items,search,onItemClick,onStatusChange}){
  const[catFilt,setCatFilt]=useState('all');
  const finished=useMemo(()=>{
    let base=items.filter(i=>i.status==='finished');
    if(catFilt!=='all')base=base.filter(i=>i.category===catFilt);
    if(search)base=base.filter(i=>i.title.toLowerCase().includes(search.toLowerCase()));
    return base.sort((a,b)=>parseSofaDate(b.dateAdded)-parseSofaDate(a.dateAdded));
  },[items,catFilt,search]);

  const counts=useMemo(()=>{
    const all=items.filter(i=>i.status==='finished');
    const c={all:all.length};
    MEDIA_TABS.forEach(t=>{c[t]=all.filter(i=>i.category===t).length;});
    return c;
  },[items]);

  const pillStyle=active=>({
    background:active?'rgba(184,116,26,0.12)':'transparent',
    border:`1px solid ${active?'#B8741A':'#D8CCBC'}`,
    color:active?'#92540A':'#6A5E48',
    borderRadius:20,padding:'4px 12px',fontSize:12.5,cursor:'pointer',
    fontFamily:'inherit',fontWeight:active?600:400,transition:'all 0.12s',whiteSpace:'nowrap',
  });

  return(
    <div>
      {/* Category filter pills */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
        <button style={pillStyle(catFilt==='all')} onClick={()=>setCatFilt('all')}>All ({counts.all})</button>
        {MEDIA_TABS.filter(t=>counts[t]>0).map(t=>(
          <button key={t} style={pillStyle(catFilt===t)} onClick={()=>setCatFilt(catFilt===t?'all':t)}>
            {TAB_ICON[t]} {t} ({counts[t]})
          </button>
        ))}
      </div>
      {finished.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#A09080'}}>
          <div style={{fontSize:32,marginBottom:10,opacity:0.4}}>📋</div>
          <div style={{fontSize:14}}>{search?`Nothing matching "${search}"`:'Nothing in your Activity Log yet'}</div>
        </div>
      ):(
        <>
          <div style={{fontSize:12,color:'#A09080',marginBottom:12}}>{finished.length.toLocaleString()} item{finished.length!==1?'s':''}</div>
          <CardGrid items={finished} onItemClick={onItemClick} onStatusChange={onStatusChange}/>
        </>
      )}
    </div>
  );
}

// ─── Edit / Add Modal ─────────────────────────────────────────────────────────
function Modal({item,onSave,onDelete,onClose}){
  const isNew=!item.id;
  const[form,setForm]=useState({title:'',list:'',category:'Books',status:'want',rating:0,recBy:'',notes:'',pinned:false,dateAdded:'',...item});
  const[confirmDelete,setConfirmDelete]=useState(false);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const inp={background:'#FDFAF5',border:'1px solid #D8CCBC',borderRadius:8,color:'#1E1810',padding:'9px 12px',fontSize:14,width:'100%',fontFamily:'inherit'};
  const lbl={fontSize:11.5,color:'#7A6E56',fontWeight:600,letterSpacing:0.5,textTransform:'uppercase',marginBottom:5,display:'block'};
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(30,20,10,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div className="modal-in" onClick={e=>e.stopPropagation()}
        style={{background:'#FFFCF6',border:'1px solid #DDD0BE',borderRadius:18,padding:28,width:'100%',maxWidth:480,maxHeight:'92vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:18,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontFamily:"'Lora',serif",fontSize:20,fontWeight:700,color:'#1E1810'}}>{isNew?'✦ Add Item':'✦ Edit Item'}</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#9A8E76',cursor:'pointer',fontSize:20,lineHeight:1,padding:4}}>✕</button>
        </div>
        <div><label style={lbl}>Title</label><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Item title…" style={inp} autoFocus/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div><label style={lbl}>Category</label>
            <select value={form.category} onChange={e=>set('category',e.target.value)} style={{...inp,cursor:'pointer'}}>
              {['Books','Audiobooks','TV Shows','Movies','Games','Podcasts'].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Status</label>
            <select value={form.status} onChange={e=>set('status',e.target.value)} style={{...inp,cursor:'pointer'}}>
              {STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={lbl}>Rating {form.rating>0&&<span style={{color:'#B8741A',textTransform:'none',letterSpacing:0,fontWeight:400}}>— {form.rating} star{form.rating!==1?'s':''}</span>}</label>
          <StarPicker value={form.rating} onChange={v=>set('rating',v)}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div><label style={lbl}>List / Source</label><input value={form.list} onChange={e=>set('list',e.target.value)} placeholder="e.g. Netflix, To Read…" style={inp}/></div>
          <div><label style={lbl}>Recommended By</label><input value={form.recBy} onChange={e=>set('recBy',e.target.value)} placeholder="Who rec'd it?" style={inp}/></div>
        </div>
        <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Thoughts, season notes, reminders…" rows={3} style={{...inp,resize:'vertical',lineHeight:1.55}}/></div>
        <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
          <input type="checkbox" checked={form.pinned} onChange={e=>set('pinned',e.target.checked)} style={{accentColor:'#B8741A',width:15,height:15,cursor:'pointer'}}/>
          <span style={{fontSize:13,color:'#6A5E48'}}>Pin to top</span>
        </label>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,paddingTop:4}}>
          <div>
            {!isNew&&!confirmDelete&&<button className="del-btn" onClick={()=>setConfirmDelete(true)} style={{background:'rgba(180,50,50,0.07)',border:'1px solid rgba(180,50,50,0.2)',color:'#A03030',borderRadius:8,padding:'8px 14px',fontSize:13,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s'}}>Delete</button>}
            {confirmDelete&&(
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontSize:12.5,color:'#A03030'}}>Sure?</span>
                <button onClick={()=>onDelete(item.id)} style={{background:'rgba(180,50,50,0.15)',border:'1px solid rgba(180,50,50,0.3)',color:'#C03030',borderRadius:7,padding:'6px 12px',fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>Yes, delete</button>
                <button onClick={()=>setConfirmDelete(false)} style={{background:'transparent',border:'1px solid #D0C4B0',color:'#7A6E56',borderRadius:7,padding:'6px 10px',fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{background:'transparent',border:'1px solid #D0C4B0',color:'#7A6E56',borderRadius:9,padding:'9px 17px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
            <button onClick={()=>form.title.trim()&&onSave(form)}
              style={{background:form.title.trim()?'#B8741A':'#D0C4B0',border:'none',color:form.title.trim()?'#FFF8EE':'#9A8E76',borderRadius:9,padding:'9px 22px',fontSize:13,fontWeight:700,cursor:form.title.trim()?'pointer':'default',fontFamily:'inherit',transition:'background 0.12s'}}>
              {isNew?'Add Item':'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  useGlobalStyles();

  const[items,setItems]=useState(()=>{try{return JSON.parse(localStorage.getItem('mySofa_v1')||'[]');}catch{return[];}});
  const[tab,setTab]=useState('Activity Log');
  const[search,setSearch]=useState('');
  const[sort,setSort]=useState('date');
  const[modal,setModal]=useState(null);
  const fileRef=useRef();

  useEffect(()=>{try{localStorage.setItem('mySofa_v1',JSON.stringify(items));}catch{}},[items]);

  const handleImport=e=>{
    const file=e.target.files[0];if(!file)return;
    const r=new FileReader();
    r.onload=ev=>setItems(parseCSV(ev.target.result).filter(r=>r['Item Title']?.trim()).map(toItem));
    r.readAsText(file);e.target.value='';
  };

  const handleExport=()=>{
    const hdrs=['Title','Category','Status','Rating','List','Notes','RecommendedBy','DateAdded','Pinned'];
    const rows=items.map(i=>[`"${i.title.replace(/"/g,'""')}"`,i.category,i.status,'⭐'.repeat(i.rating),`"${i.list}"`,`"${(i.notes||'').replace(/"/g,'""')}"`,`"${i.recBy}"`,i.dateAdded,i.pinned].join(','));
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([[hdrs.join(','),...rows].join('\n')],{type:'text/csv'}));
    a.download=`mysofa-${new Date().toISOString().slice(0,10)}.csv`;a.click();
  };

  const saveItem=form=>{
    if(form.id){
      const prev=items.find(i=>i.id===form.id);
      if(prev&&(prev.title!==form.title||prev.category!==form.category)){delete _imgCache[`${form.category}::${form.title}`];saveImgCache(_imgCache);}
      setItems(p=>p.map(i=>i.id===form.id?{...form}:i));
    }else{
      const today=new Date();
      setItems(p=>[{...form,id:genId(),dateAdded:`${today.getMonth()+1}/${today.getDate()}/${String(today.getFullYear()).slice(2)}`},...p]);
    }
    setModal(null);
  };
  const deleteItem=id=>{setItems(p=>p.filter(i=>i.id!==id));setModal(null);};
  const updateStatus=(id,status)=>setItems(p=>p.map(i=>i.id===id?{...i,status}:i));

  const tabCounts=useMemo(()=>{
    const c={'Activity Log':items.filter(i=>i.status==='finished').length};
    MEDIA_TABS.forEach(t=>{c[t]=items.filter(i=>i.category===t&&i.status!=='finished').length;});
    return c;
  },[items]);

  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:'#F4EEE4',minHeight:'100vh',color:'#1E1810'}}>

      {/* Header */}
      <header style={{borderBottom:'1px solid #DDD0BE',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'rgba(244,238,228,0.97)',backdropFilter:'blur(10px)',zIndex:200,boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10}}>
          <span style={{fontFamily:"'Lora',serif",fontSize:22,fontWeight:700,color:'#2A1E10',letterSpacing:-0.3}}>✦ MySofa</span>
          {items.length>0&&<span style={{fontSize:12,color:'#A09080'}}>{items.length.toLocaleString()} items</span>}
        </div>
        <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} style={{display:'none'}}/>
          <button className="ghost-btn" onClick={()=>fileRef.current.click()}
            style={{background:'transparent',border:'1px solid #D0C4B0',color:'#7A6E58',borderRadius:8,padding:'7px 13px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>↑ Import CSV</button>
          {items.length>0&&<button className="ghost-btn" onClick={handleExport}
            style={{background:'transparent',border:'1px solid #D0C4B0',color:'#7A6E58',borderRadius:8,padding:'7px 13px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>↓ Export</button>}
          <button onClick={()=>setModal({item:{}})}
            style={{background:'#B8741A',border:'none',color:'#FFF8EE',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',letterSpacing:0.2}}>+ Add</button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{borderBottom:'1px solid #DDD0BE',padding:'0 20px',display:'flex',gap:0,overflowX:'auto',background:'rgba(244,238,228,0.8)'}}>
        {TABS.map(t=>(
          <button key={t} className="tab-btn"
            onClick={()=>{setTab(t);setSearch('');}}
            style={{background:'none',border:'none',borderBottom:tab===t?'2.5px solid #B8741A':'2.5px solid transparent',color:tab===t?'#92540A':'#7A6E58',padding:'12px 13px 10px',fontSize:13.5,cursor:'pointer',fontFamily:'inherit',fontWeight:tab===t?700:400,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
            <span>{TAB_ICON[t]}</span>{t}
            {tabCounts[t]>0&&<span style={{fontSize:11,padding:'1px 6px',borderRadius:10,background:tab===t?'rgba(184,116,26,0.15)':'rgba(0,0,0,0.05)',color:tab===t?'#92540A':'#9A8878'}}>{tabCounts[t]}</span>}
          </button>
        ))}
      </div>

      {/* Search + sort bar */}
      {items.length>0&&(
        <div style={{padding:'10px 20px',display:'flex',gap:8,alignItems:'center',borderBottom:'1px solid #EAE0D0',background:'rgba(252,248,242,0.8)'}}>
          <div style={{position:'relative',flex:'1 1 200px'}}>
            <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'#B8A898',fontSize:15,pointerEvents:'none'}}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder={`Search ${tab==='Activity Log'?'activity log':tab.toLowerCase()}…`}
              style={{background:'#FFFFFF',border:'1px solid #DDD0BE',borderRadius:8,color:'#1E1810',padding:'8px 11px 8px 32px',fontSize:13.5,width:'100%',fontFamily:'inherit'}}/>
          </div>
          {search&&<button onClick={()=>setSearch('')} style={{background:'transparent',border:'none',color:'#9A8878',fontSize:13,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline',padding:'4px'}}>Clear</button>}
        </div>
      )}

      {/* Content */}
      <div style={{padding:'18px 20px',paddingBottom:60}}>
        {items.length===0?(
          <div style={{textAlign:'center',padding:'100px 20px 60px'}}>
            <div style={{fontSize:56,marginBottom:20}}>🛋️</div>
            <div style={{fontFamily:"'Lora',serif",fontSize:26,color:'#2A1E10',marginBottom:10,fontWeight:700}}>Welcome to MySofa</div>
            <div style={{fontSize:15,color:'#7A6E58',marginBottom:30,lineHeight:1.7,maxWidth:360,margin:'0 auto 30px'}}>
              Import your Sofa CSV export to bring in all your books, shows, games and more — or start fresh by adding items manually.
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
              <button onClick={()=>fileRef.current.click()} style={{background:'#B8741A',border:'none',color:'#FFF8EE',borderRadius:10,padding:'12px 24px',fontSize:14.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>↑ Import Sofa CSV</button>
              <button onClick={()=>setModal({item:{}})} style={{background:'transparent',border:'1.5px solid #C8B89A',color:'#7A6E58',borderRadius:10,padding:'12px 22px',fontSize:14.5,cursor:'pointer',fontFamily:'inherit'}}>+ Add manually</button>
            </div>
          </div>
        ):tab==='Activity Log'?(
          <ActivityLogView items={items} search={search} onItemClick={i=>setModal({item:i})} onStatusChange={updateStatus}/>
        ):(
          <CategoryView items={items} category={tab} search={search} onItemClick={i=>setModal({item:i})} onStatusChange={updateStatus}/>
        )}
      </div>

      {modal&&<Modal item={modal.item} onSave={saveItem} onDelete={deleteItem} onClose={()=>setModal(null)}/>}
    </div>
  );
}
