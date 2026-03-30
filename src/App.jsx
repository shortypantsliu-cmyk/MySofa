import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ─── Global Styles ───────────────────────────────────────────────────────────
function useGlobalStyles() {
  useEffect(() => {
    if (document.getElementById('md-styles')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap';
    document.head.appendChild(link);
    const s = document.createElement('style');
    s.id = 'md-styles';
    s.textContent = `
      *{box-sizing:border-box}
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#3D3020;border-radius:3px}
      .ic{cursor:pointer;transition:transform 0.15s,box-shadow 0.15s}
      .ic:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.5) !important}
      .tab-b{transition:color 0.12s,border-color 0.12s}
      .tab-b:hover{color:#C8961C !important}
      .ghost-btn{transition:background 0.12s,border-color 0.12s,color 0.12s}
      .ghost-btn:hover{background:rgba(200,150,28,0.1) !important;border-color:#C8961C !important;color:#C8961C !important}
      .status-cycle{cursor:pointer;transition:opacity 0.1s}
      .status-cycle:hover{opacity:0.7}
      input:focus,textarea:focus,select:focus{outline:none;border-color:#C8961C !important;box-shadow:0 0 0 2px rgba(200,150,28,0.12)}
      @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      .fade-up{animation:fadeUp 0.18s ease both}
      @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .shimmer{background:linear-gradient(90deg,#1C1710 25%,#2A2318 50%,#1C1710 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
      @keyframes modalIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
      .modal-in{animation:modalIn 0.15s ease}
      .del-btn:hover{background:rgba(200,60,60,0.2) !important;color:#e87070 !important;border-color:rgba(200,60,60,0.4) !important}
    `;
    document.head.appendChild(s);
  }, []);
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function parseCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
  if (lines.length < 2) return [];
  const hdrs = parseCSVLine(lines[0]).map(h=>h.trim());
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    const obj = {};
    hdrs.forEach((h,i) => { obj[h] = (cols[i]||'').trim(); });
    return obj;
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_MAP = {
  'Book':'Books','Audiobook':'Audiobooks','TV Show':'TV Shows',
  'Movie':'Movies','Video Game':'Games','Podcast':'Podcasts',
};
const TABS = ['All','Books','Audiobooks','TV Shows','Movies','Games','Podcasts'];
const TAB_ICON = { All:'◈', Books:'📖', Audiobooks:'🎧', 'TV Shows':'📺', Movies:'🎬', Games:'🎮', Podcasts:'🎙️' };
const CAT_CLR = {
  Books:'#B48FD8', Audiobooks:'#7AB0DE', 'TV Shows':'#D97B63',
  Movies:'#D4A85C', Games:'#5BBF90', Podcasts:'#C8C05A', Other:'#888',
};
const CAT_EMOJI = { Books:'📖', Audiobooks:'🎧', 'TV Shows':'📺', Movies:'🎬', Games:'🎮', Podcasts:'🎙️', Other:'◈' };
const STATUSES = [
  { id:'want',        label:'Want',        bg:'rgba(74,124,158,0.2)',  text:'#7DBCE8', bdr:'rgba(74,124,158,0.45)' },
  { id:'in-progress', label:'In Progress', bg:'rgba(210,135,28,0.2)', text:'#E8AA50', bdr:'rgba(210,135,28,0.45)' },
  { id:'finished',    label:'Finished',    bg:'rgba(88,155,100,0.2)', text:'#7EC48E', bdr:'rgba(88,155,100,0.45)' },
];
const ST = Object.fromEntries(STATUSES.map(s=>[s.id,s]));
const STATUS_CYCLE = { want:'in-progress', 'in-progress':'finished', finished:'want' };
const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const countStars = s => (s.match(/⭐/g)||[]).length;
const genId = () => 'i'+Date.now()+Math.random().toString(36).slice(2,6);
function parseSofaDate(str) {
  if (!str) return 0;
  const p = str.split('/');
  if (p.length !== 3) return 0;
  const [m,d,y] = p.map(Number);
  return new Date(y<100?2000+y:y, m-1, d).getTime();
}
function cleanTitle(s) {
  return (s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
}
function toItem(raw) {
  const list = raw['List Name']||'';
  const sr = (raw['Status']||'').toLowerCase();
  const status =
    sr.includes('progress') ? 'in-progress' :
    sr.includes('finish')||sr==='done'||sr==='completed' ? 'finished' :
    list==='Activity' ? 'finished' : 'want';
  return {
    id: genId(),
    title: cleanTitle(raw['Item Title']),
    list,
    category: CAT_MAP[raw['Category']]||raw['Category']||'Other',
    dateAdded: raw['Date Added']||'',
    pinned: (raw['Pinned']||'').toLowerCase()==='true',
    rating: countStars(raw['Rating']||''),
    recBy: raw['Recommended By']||'',
    status,
    notes: raw['Notes']||'',
  };
}

// ─── Image Fetch Queue ────────────────────────────────────────────────────────
const _q = { q: [], running: false };
function enqueue(fn) {
  return new Promise(resolve => {
    _q.q.push({ fn, resolve });
    if (!_q.running) _processQueue();
  });
}
async function _processQueue() {
  if (_q.q.length === 0) { _q.running = false; return; }
  _q.running = true;
  const { fn, resolve } = _q.q.shift();
  try { resolve(await fn()); } catch { resolve(null); }
  await new Promise(r => setTimeout(r, 90));
  _processQueue();
}

async function fetchCoverArt(title, category, tmdbToken) {
  if (!title) return null;
  const enc = encodeURIComponent(title);
  try {
    if (category === 'Movies') {
      if (tmdbToken) {
        const r = await fetch(`https://api.themoviedb.org/3/search/movie?query=${enc}&language=en-US&page=1`, {
          headers: { Authorization: `Bearer ${tmdbToken}` }
        });
        const d = await r.json();
        const p = d.results?.[0]?.poster_path;
        if (p) return TMDB_IMG + p;
      }
      const r2 = await fetch(`https://itunes.apple.com/search?term=${enc}&media=movie&limit=1`);
      const d2 = await r2.json();
      return d2.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb') || null;
    }
    if (category === 'TV Shows') {
      if (tmdbToken) {
        const r = await fetch(`https://api.themoviedb.org/3/search/tv?query=${enc}&language=en-US&page=1`, {
          headers: { Authorization: `Bearer ${tmdbToken}` }
        });
        const d = await r.json();
        const p = d.results?.[0]?.poster_path;
        if (p) return TMDB_IMG + p;
      }
      const r2 = await fetch(`https://itunes.apple.com/search?term=${enc}&media=tvShow&limit=1`);
      const d2 = await r2.json();
      return d2.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb') || null;
    }
    if (category === 'Books') {
      const r = await fetch(`https://openlibrary.org/search.json?title=${enc}&limit=1&fields=cover_i`);
      const d = await r.json();
      const covId = d.docs?.[0]?.cover_i;
      if (covId) return `https://covers.openlibrary.org/b/id/${covId}-M.jpg`;
      const r2 = await fetch(`https://itunes.apple.com/search?term=${enc}&media=ebook&limit=1`);
      const d2 = await r2.json();
      return d2.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb') || null;
    }
    if (category === 'Audiobooks') {
      const r = await fetch(`https://itunes.apple.com/search?term=${enc}&media=audiobook&limit=1`);
      const d = await r.json();
      const img = d.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb');
      if (img) return img;
      const r2 = await fetch(`https://openlibrary.org/search.json?title=${enc}&limit=1&fields=cover_i`);
      const d2 = await r2.json();
      const cid = d2.docs?.[0]?.cover_i;
      return cid ? `https://covers.openlibrary.org/b/id/${cid}-M.jpg` : null;
    }
    if (category === 'Podcasts') {
      const r = await fetch(`https://itunes.apple.com/search?term=${enc}&media=podcast&limit=1`);
      const d = await r.json();
      return d.results?.[0]?.artworkUrl100?.replace('100x100bb','600x600bb') || null;
    }
    if (category === 'Games') {
      const r = await fetch(`https://itunes.apple.com/search?term=${enc}&entity=game&limit=1`);
      const d = await r.json();
      return d.results?.[0]?.artworkUrl100?.replace('100x100bb','300x300bb') || null;
    }
  } catch {}
  return null;
}

// ─── Image Cache ──────────────────────────────────────────────────────────────
const IMG_CACHE_KEY = 'mediaDiary_imgCache_v1';
function loadImgCache() {
  try { return JSON.parse(localStorage.getItem(IMG_CACHE_KEY)||'{}'); } catch { return {}; }
}
function saveImgCache(cache) {
  try { localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(cache)); } catch {}
}
let _imgCache = loadImgCache();

// ─── useCoverArt hook ─────────────────────────────────────────────────────────
function useCoverArt(title, category, tmdbToken) {
  const key = `${category}::${title}`;
  const cached = _imgCache[key];
  const [url, setUrl] = useState(cached !== undefined ? cached : undefined);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    if (!title || url !== undefined) return;
    let cancelled = false;
    setLoading(true);
    enqueue(() => fetchCoverArt(title, category, tmdbToken)).then(result => {
      if (cancelled) return;
      _imgCache[key] = result || null;
      saveImgCache(_imgCache);
      setUrl(result || null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [title, category, key, tmdbToken]);

  return { url, loading };
}

// ─── Stars ────────────────────────────────────────────────────────────────────
function Stars({ n, size=12 }) {
  if (!n) return null;
  return <span style={{ color:'#C8961C', fontSize:size, letterSpacing:-0.5, lineHeight:1 }}>{'★'.repeat(n)}{'☆'.repeat(5-n)}</span>;
}

function StarPicker({ value, onChange }) {
  const [h, setH] = useState(0);
  return (
    <div style={{ display:'flex', gap:4 }}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onClick={()=>onChange(n===value?0:n)}
          onMouseEnter={()=>setH(n)} onMouseLeave={()=>setH(0)}
          style={{ fontSize:24, color:n<=(h||value)?'#C8961C':'#3D3020', cursor:'pointer', transition:'color 0.1s,transform 0.1s', transform:n<=(h||value)?'scale(1.1)':'scale(1)' }}>★</span>
      ))}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ status, onClick, sm }) {
  const s = ST[status]||ST.want;
  return (
    <span onClick={onClick} className={onClick?'status-cycle':''}
      style={{ background:s.bg, color:s.text, border:`1px solid ${s.bdr}`, borderRadius:20, padding:sm?'1px 7px':'2px 9px', fontSize:sm?10:11.5, fontWeight:500, letterSpacing:0.3, cursor:onClick?'pointer':'default', userSelect:'none', whiteSpace:'nowrap' }}>
      {s.label}
    </span>
  );
}

// ─── Cover Placeholder ────────────────────────────────────────────────────────
function CoverPlaceholder({ category, title }) {
  const clr = CAT_CLR[category]||'#888';
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, background:'linear-gradient(145deg,#1C1710,#0F0D08)' }}>
      <span style={{ fontSize:32, opacity:0.45 }}>{CAT_EMOJI[category]||'◈'}</span>
      <div style={{ fontSize:11, color:clr, fontWeight:600, textAlign:'center', padding:'0 10px', lineHeight:1.35, opacity:0.65, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical' }}>{title}</div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ item, onClick, onStatusChange, tmdbToken }) {
  const { url, loading } = useCoverArt(item.title, item.category, tmdbToken);
  const [imgErr, setImgErr] = useState(false);
  const showPlaceholder = !loading && (!url || imgErr);

  return (
    <div className="ic fade-up" onClick={()=>onClick(item)}
      style={{ background:'#1C1710', border:'1px solid #2A2016', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 2px 12px rgba(0,0,0,0.3)' }}>
      {/* Poster */}
      <div style={{ position:'relative', width:'100%', paddingTop:'148%', background:'#141009', flexShrink:0 }}>
        <div style={{ position:'absolute', inset:0 }}>
          {loading && <div className="shimmer" style={{ width:'100%', height:'100%' }} />}
          {showPlaceholder && <CoverPlaceholder category={item.category} title={item.title} />}
          {!loading && url && !imgErr && (
            <img src={url} alt={item.title} onError={()=>setImgErr(true)}
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
          )}
          {/* gradient overlay */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'55%', background:'linear-gradient(to top,rgba(10,8,5,0.97) 0%,rgba(10,8,5,0.6) 50%,transparent 100%)', pointerEvents:'none' }} />
          {/* category dot */}
          <div style={{ position:'absolute', top:8, left:8, width:8, height:8, borderRadius:'50%', background:CAT_CLR[item.category]||'#888', boxShadow:`0 0 6px ${CAT_CLR[item.category]||'#888'}88` }} />
          {item.pinned && <div style={{ position:'absolute', top:7, right:8, fontSize:12, color:'#C8961C' }}>⊞</div>}
          {/* status + rating over gradient */}
          <div style={{ position:'absolute', bottom:8, left:8 }}>
            <Badge status={item.status} sm onClick={e=>{ e.stopPropagation(); onStatusChange(item.id, STATUS_CYCLE[item.status]); }} />
          </div>
          {item.rating>0 && <div style={{ position:'absolute', bottom:8, right:8 }}><Stars n={item.rating} size={10} /></div>}
        </div>
      </div>
      {/* Info strip */}
      <div style={{ padding:'9px 10px 10px', display:'flex', flexDirection:'column', gap:4 }}>
        <div style={{ fontSize:12.5, fontWeight:500, color:'#EDE4D2', lineHeight:1.35, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
          {item.title}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:2 }}>
          <span style={{ fontSize:10, color:'#3A3020', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'65%' }}>
            {item.list && item.list!=='Activity' ? item.list : ''}
          </span>
          <div style={{ display:'flex', gap:5, alignItems:'center', flexShrink:0 }}>
            {item.recBy && <span title={`Rec'd by ${item.recBy}`} style={{ fontSize:10, color:'#5A4E3A' }}>👤</span>}
            {item.notes && <span title={item.notes} style={{ fontSize:10, color:'#4A4030' }}>✎</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TMDB Token Modal ─────────────────────────────────────────────────────────
function TokenModal({ current, onSave, onClose }) {
  const [val, setVal] = useState(current||'');
  const inp = { background:'#161210', border:'1px solid #3A2E1C', borderRadius:8, color:'#EDE4D2', padding:'9px 12px', fontSize:13, width:'100%', fontFamily:'inherit' };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div className="modal-in" onClick={e=>e.stopPropagation()}
        style={{ background:'#1C1710', border:'1px solid #3A2E1C', borderRadius:16, padding:26, width:'100%', maxWidth:460 }}>
        <div style={{ fontFamily:"'Lora',serif", fontSize:18, fontWeight:700, color:'#EDE4D2', marginBottom:6 }}>TMDB API Token</div>
        <p style={{ fontSize:12.5, color:'#7A6E56', lineHeight:1.65, marginBottom:18 }}>
          Paste your TMDB <strong style={{color:'#9A8E76'}}>Read Access Token</strong> (found under <em>themoviedb.org → Settings → API</em>). Used to fetch posters for movies and TV shows. Stored only in your browser's localStorage.
        </p>
        <input value={val} onChange={e=>setVal(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiJ9…" style={{...inp, marginBottom:16, fontFamily:'monospace', fontSize:11}} />
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          {current && <button onClick={()=>{ onSave(''); onClose(); }} style={{ background:'transparent', border:'1px solid rgba(180,50,50,0.3)', color:'#c08080', borderRadius:8, padding:'7px 13px', fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Remove</button>}
          <button onClick={onClose} style={{ background:'transparent', border:'1px solid #3A2E1C', color:'#9A8E76', borderRadius:8, padding:'7px 15px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          <button onClick={()=>{ onSave(val.trim()); onClose(); }}
            style={{ background:'#C8961C', border:'none', color:'#13100B', borderRadius:8, padding:'7px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function Modal({ item, onSave, onDelete, onClose }) {
  const isNew = !item.id;
  const [form, setForm] = useState({ title:'', list:'', category:'Books', status:'want', rating:0, recBy:'', notes:'', pinned:false, dateAdded:'', ...item });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const inp = { background:'#161210', border:'1px solid #3A2E1C', borderRadius:8, color:'#EDE4D2', padding:'8px 11px', fontSize:13, width:'100%', fontFamily:'inherit' };
  const lbl = { fontSize:11, color:'#7A6E56', fontWeight:600, letterSpacing:0.6, textTransform:'uppercase', marginBottom:5, display:'block' };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div className="modal-in" onClick={e=>e.stopPropagation()}
        style={{ background:'#1C1710', border:'1px solid #3A2E1C', borderRadius:16, padding:26, width:'100%', maxWidth:470, maxHeight:'92vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:"'Lora',serif", fontSize:19, fontWeight:700, color:'#EDE4D2' }}>{isNew?'✦ Add Item':'✦ Edit Item'}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#5A4E3A', cursor:'pointer', fontSize:18, lineHeight:1, padding:4 }}>✕</button>
        </div>
        <div>
          <label style={lbl}>Title</label>
          <input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Item title…" style={inp} autoFocus />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div>
            <label style={lbl}>Category</label>
            <select value={form.category} onChange={e=>set('category',e.target.value)} style={{...inp,cursor:'pointer'}}>
              {['Books','Audiobooks','TV Shows','Movies','Games','Podcasts'].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select value={form.status} onChange={e=>set('status',e.target.value)} style={{...inp,cursor:'pointer'}}>
              {STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={lbl}>Rating {form.rating>0 && <span style={{color:'#C8961C',textTransform:'none',letterSpacing:0,fontWeight:400}}>— {form.rating} star{form.rating!==1?'s':''}</span>}</label>
          <StarPicker value={form.rating} onChange={v=>set('rating',v)} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div>
            <label style={lbl}>List / Source</label>
            <input value={form.list} onChange={e=>set('list',e.target.value)} placeholder="e.g. Netflix, To Read…" style={inp} />
          </div>
          <div>
            <label style={lbl}>Recommended By</label>
            <input value={form.recBy} onChange={e=>set('recBy',e.target.value)} placeholder="Who rec'd it?" style={inp} />
          </div>
        </div>
        <div>
          <label style={lbl}>Notes</label>
          <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Season notes, thoughts, reminders…" rows={3} style={{...inp,resize:'vertical',lineHeight:1.55}} />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
          <input type="checkbox" checked={form.pinned} onChange={e=>set('pinned',e.target.checked)} style={{ accentColor:'#C8961C', width:15, height:15, cursor:'pointer' }} />
          <span style={{ fontSize:13, color:'#9A8E76' }}>Pin to top</span>
        </label>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, paddingTop:4 }}>
          <div>
            {!isNew && !confirmDelete && (
              <button className="del-btn" onClick={()=>setConfirmDelete(true)}
                style={{ background:'rgba(180,50,50,0.1)', border:'1px solid rgba(180,50,50,0.2)', color:'#c08080', borderRadius:8, padding:'7px 13px', fontSize:12.5, cursor:'pointer', fontFamily:'inherit', transition:'all 0.12s' }}>Delete</button>
            )}
            {confirmDelete && (
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ fontSize:12, color:'#c08080' }}>Sure?</span>
                <button onClick={()=>onDelete(item.id)} style={{ background:'rgba(180,50,50,0.25)', border:'1px solid rgba(180,50,50,0.4)', color:'#e87070', borderRadius:7, padding:'5px 11px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Yes, delete</button>
                <button onClick={()=>setConfirmDelete(false)} style={{ background:'transparent', border:'1px solid #3A2E1C', color:'#7A6E56', borderRadius:7, padding:'5px 9px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ background:'transparent', border:'1px solid #3A2E1C', color:'#9A8E76', borderRadius:9, padding:'8px 16px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            <button onClick={()=>form.title.trim()&&onSave(form)}
              style={{ background:form.title.trim()?'#C8961C':'#5A4E3A', border:'none', color:form.title.trim()?'#13100B':'#7A6E56', borderRadius:9, padding:'8px 20px', fontSize:13, fontWeight:600, cursor:form.title.trim()?'pointer':'default', fontFamily:'inherit' }}>
              {isNew?'Add Item':'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  useGlobalStyles();

  const [items, setItems] = useState(()=>{ try { return JSON.parse(localStorage.getItem('mediaDiary_v1')||'[]'); } catch { return []; } });
  const [tmdbToken, setTmdbToken] = useState(()=>localStorage.getItem('mediaDiary_tmdb')||'');
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [stFilter, setStFilter] = useState('all');
  const [listFilt, setListFilt] = useState('all');
  const [sort, setSort] = useState('date');
  const [modal, setModal] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const fileRef = useRef();

  useEffect(()=>{ try { localStorage.setItem('mediaDiary_v1',JSON.stringify(items)); } catch {} }, [items]);

  const saveToken = useCallback(t => {
    setTmdbToken(t);
    if (t) localStorage.setItem('mediaDiary_tmdb', t);
    else localStorage.removeItem('mediaDiary_tmdb');
    _imgCache = {}; saveImgCache({});
  }, []);

  const listNames = useMemo(()=>{
    const src = tab==='All' ? items : items.filter(i=>i.category===tab);
    return [...new Set(src.map(i=>i.list).filter(l=>l&&l!=='Activity'))].sort();
  }, [items, tab]);

  const tabCounts = useMemo(()=>{
    const c = { All: items.length };
    TABS.slice(1).forEach(t=>{ c[t]=items.filter(i=>i.category===t).length; });
    return c;
  }, [items]);

  const stCounts = useMemo(()=>{
    const src = tab==='All' ? items : items.filter(i=>i.category===tab);
    return { all:src.length, want:src.filter(i=>i.status==='want').length, 'in-progress':src.filter(i=>i.status==='in-progress').length, finished:src.filter(i=>i.status==='finished').length };
  }, [items, tab]);

  const filtered = useMemo(()=>
    items.filter(i=>{
      if (tab!=='All' && i.category!==tab) return false;
      if (stFilter!=='all' && i.status!==stFilter) return false;
      if (listFilt!=='all' && i.list!==listFilt) return false;
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a,b)=>{
      if (a.pinned!==b.pinned) return a.pinned?-1:1;
      if (sort==='title') return a.title.localeCompare(b.title);
      if (sort==='rating') return b.rating-a.rating || parseSofaDate(b.dateAdded)-parseSofaDate(a.dateAdded);
      return parseSofaDate(b.dateAdded)-parseSofaDate(a.dateAdded);
    })
  , [items, tab, stFilter, listFilt, search, sort]);

  const handleImport = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => setItems(parseCSV(ev.target.result).filter(r=>r['Item Title']?.trim()).map(toItem));
    r.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    const hdrs = ['Title','Category','Status','Rating','List','Notes','RecommendedBy','DateAdded','Pinned'];
    const rows = items.map(i=>[`"${i.title.replace(/"/g,'""')}"`,i.category,i.status,'⭐'.repeat(i.rating),`"${i.list}"`,`"${(i.notes||'').replace(/"/g,'""')}"`,`"${i.recBy}"`,i.dateAdded,i.pinned].join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[hdrs.join(','),...rows].join('\n')],{type:'text/csv'}));
    a.download = `media-diary-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const saveItem = form => {
    if (form.id) {
      const prev = items.find(i=>i.id===form.id);
      if (prev && (prev.title!==form.title||prev.category!==form.category)) {
        delete _imgCache[`${form.category}::${form.title}`]; saveImgCache(_imgCache);
      }
      setItems(p=>p.map(i=>i.id===form.id?{...form}:i));
    } else {
      const today = new Date();
      setItems(p=>[{...form, id:genId(), dateAdded:`${today.getMonth()+1}/${today.getDate()}/${String(today.getFullYear()).slice(2)}`},...p]);
    }
    setModal(null);
  };

  const deleteItem = id => { setItems(p=>p.filter(i=>i.id!==id)); setModal(null); };
  const updateStatus = (id, status) => setItems(p=>p.map(i=>i.id===id?{...i,status}:i));
  const fbs = active => ({
    background:active?'rgba(200,150,28,0.14)':'transparent', border:`1px solid ${active?'#C8961C':'#2E2418'}`,
    color:active?'#C8961C':'#6A5E48', borderRadius:8, padding:'5px 11px', fontSize:12,
    cursor:'pointer', fontFamily:'inherit', fontWeight:active?600:400, transition:'all 0.12s', whiteSpace:'nowrap',
  });

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:'#131009', minHeight:'100vh', color:'#EDE4D2' }}>

      {/* Header */}
      <header style={{ borderBottom:'1px solid #241E10', padding:'13px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'rgba(19,16,9,0.96)', backdropFilter:'blur(10px)', zIndex:200 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
          <span style={{ fontFamily:"'Lora',serif", fontSize:21, fontWeight:700, color:'#EDE4D2', letterSpacing:-0.3 }}>✦ MySofa</span>
          {items.length>0 && <span style={{ fontSize:11.5, color:'#4A4030' }}>{items.length.toLocaleString()} items</span>}
        </div>
        <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} style={{ display:'none' }} />
          <button className="ghost-btn" onClick={()=>setShowTokenModal(true)}
            style={{ background:'transparent', border:`1px solid ${tmdbToken?'#4A7A3A':'#2E2418'}`, color:tmdbToken?'#7ABF6A':'#8A7E66', borderRadius:8, padding:'6px 11px', fontSize:12, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:13 }}>{tmdbToken?'🎬':'🔑'}</span>
            <span style={{ fontSize:11 }}>{tmdbToken?'TMDB ✓':'TMDB Key'}</span>
          </button>
          <button className="ghost-btn" onClick={()=>fileRef.current.click()}
            style={{ background:'transparent', border:'1px solid #2E2418', color:'#8A7E66', borderRadius:8, padding:'6px 13px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>↑ Import CSV</button>
          {items.length>0 && (
            <button className="ghost-btn" onClick={handleExport}
              style={{ background:'transparent', border:'1px solid #2E2418', color:'#8A7E66', borderRadius:8, padding:'6px 13px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>↓ Export</button>
          )}
          <button onClick={()=>setModal({item:{}})}
            style={{ background:'#C8961C', border:'none', color:'#13100B', borderRadius:8, padding:'7px 15px', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ Add</button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ borderBottom:'1px solid #1E1810', padding:'0 20px', display:'flex', gap:0, overflowX:'auto', background:'rgba(19,16,9,0.7)' }}>
        {TABS.map(t=>(
          <button key={t} className="tab-b" onClick={()=>{ setTab(t); setListFilt('all'); setStFilter('all'); }}
            style={{ background:'none', border:'none', borderBottom:tab===t?'2px solid #C8961C':'2px solid transparent', color:tab===t?'#C8961C':'#6A5E48', padding:'12px 14px 10px', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:tab===t?600:400, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
            <span>{TAB_ICON[t]}</span>{t}
            {tabCounts[t]>0 && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:tab===t?'rgba(200,150,28,0.15)':'rgba(255,255,255,0.04)', color:tab===t?'#C8961C':'#4A4030' }}>{tabCounts[t]}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ padding:'11px 20px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', borderBottom:'1px solid #1A1608', background:'rgba(19,16,9,0.5)' }}>
        <div style={{ position:'relative', flex:'1 1 160px' }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#4A4030', fontSize:14, pointerEvents:'none' }}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab==='All'?'all items':tab.toLowerCase()}…`}
            style={{ background:'#181410', border:'1px solid #2A2010', borderRadius:8, color:'#EDE4D2', padding:'7px 10px 7px 30px', fontSize:12.5, width:'100%', fontFamily:'inherit' }} />
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          <button style={fbs(stFilter==='all')} onClick={()=>setStFilter('all')}>All ({stCounts.all})</button>
          <button style={fbs(stFilter==='want')} onClick={()=>setStFilter(stFilter==='want'?'all':'want')}>Want ({stCounts.want})</button>
          <button style={fbs(stFilter==='in-progress')} onClick={()=>setStFilter(stFilter==='in-progress'?'all':'in-progress')}>In Progress ({stCounts['in-progress']})</button>
          <button style={fbs(stFilter==='finished')} onClick={()=>setStFilter(stFilter==='finished'?'all':'finished')}>Finished ({stCounts.finished})</button>
        </div>
        {listNames.length>1 && (
          <select value={listFilt} onChange={e=>setListFilt(e.target.value)}
            style={{ background:'#181410', border:'1px solid #2A2010', borderRadius:8, color:listFilt==='all'?'#6A5E48':'#EDE4D2', padding:'7px 10px', fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>
            <option value="all">All lists</option>
            {listNames.map(l=><option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <select value={sort} onChange={e=>setSort(e.target.value)}
          style={{ background:'#181410', border:'1px solid #2A2010', borderRadius:8, color:'#6A5E48', padding:'7px 10px', fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>
          <option value="date">Recent first</option>
          <option value="title">A → Z</option>
          <option value="rating">Top rated</option>
        </select>
        {(search||stFilter!=='all'||listFilt!=='all') && (
          <button onClick={()=>{ setSearch(''); setStFilter('all'); setListFilt('all'); }}
            style={{ background:'transparent', border:'none', color:'#7A6E56', fontSize:12, cursor:'pointer', fontFamily:'inherit', padding:'5px 4px', textDecoration:'underline' }}>Clear</button>
        )}
      </div>

      {/* Content */}
      <div style={{ padding:'16px 20px', paddingBottom:50 }}>
        {items.length===0 ? (
          <div style={{ textAlign:'center', padding:'90px 20px 60px' }}>
            <div style={{ fontSize:52, marginBottom:18 }}>📚</div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:24, color:'#EDE4D2', marginBottom:10, fontWeight:700 }}>Your Media Diary</div>
            <div style={{ fontSize:14, color:'#5A4E3A', marginBottom:28, lineHeight:1.7, maxWidth:340, margin:'0 auto 28px' }}>
              Import your Sofa CSV export to bring in all your books, shows, games and more — or start fresh by adding items manually.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={()=>fileRef.current.click()} style={{ background:'#C8961C', border:'none', color:'#13100B', borderRadius:10, padding:'11px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>↑ Import Sofa CSV</button>
              <button onClick={()=>setModal({item:{}})} style={{ background:'transparent', border:'1px solid #3A2E1C', color:'#9A8E76', borderRadius:10, padding:'11px 20px', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>+ Add manually</button>
            </div>
          </div>
        ) : filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#4A4030' }}>
            <div style={{ fontSize:34, marginBottom:12, opacity:0.5 }}>◈</div>
            <div style={{ fontSize:14 }}>No items match your current filters</div>
            <button onClick={()=>{ setSearch(''); setStFilter('all'); setListFilt('all'); }}
              style={{ marginTop:14, background:'transparent', border:'1px solid #3A2E1C', color:'#7A6E56', borderRadius:8, padding:'7px 16px', fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Clear filters</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize:11.5, color:'#4A4030', marginBottom:12 }}>
              Showing {filtered.length.toLocaleString()}{filtered.length!==items.length?` of ${items.length.toLocaleString()} `:' '}item{filtered.length!==1?'s':''}
              {!tmdbToken && items.filter(i=>i.category==='Movies'||i.category==='TV Shows').length>0 && (
                <span style={{ marginLeft:10, color:'#5A4A2A' }}>
                  · <span style={{ cursor:'pointer', textDecoration:'underline' }} onClick={()=>setShowTokenModal(true)}>Add TMDB key</span> for movie & TV posters
                </span>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))', gap:10 }}>
              {filtered.map(item=>(
                <Card key={item.id} item={item} onClick={i=>setModal({item:i})} onStatusChange={updateStatus} tmdbToken={tmdbToken} />
              ))}
            </div>
          </>
        )}
      </div>

      {modal && <Modal item={modal.item} onSave={saveItem} onDelete={deleteItem} onClose={()=>setModal(null)} />}
      {showTokenModal && <TokenModal current={tmdbToken} onSave={saveToken} onClose={()=>setShowTokenModal(false)} />}
    </div>
  );
}
