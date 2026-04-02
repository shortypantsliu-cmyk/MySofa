import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ─── TMDB TOKEN (set via Netlify env var VITE_TMDB_TOKEN) ────────────────────
const TMDB_TOKEN = import.meta.env.VITE_TMDB_TOKEN || "";

// ─── RAWG KEY (set via Netlify env var VITE_RAWG_KEY) ────────────────────────
const RAWG_KEY = import.meta.env.VITE_RAWG_KEY || "";

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
      .tab-btn{transition:color 0.12s;white-space:nowrap}
      .tab-btn:hover{color:#B8741A !important}
      .ghost-btn{transition:all 0.12s}
      .ghost-btn:hover{background:rgba(184,116,26,0.1) !important;border-color:#B8741A !important;color:#B8741A !important}
      .status-cycle{cursor:pointer;transition:opacity 0.1s}
      .status-cycle:hover{opacity:0.65}
      input:focus,textarea:focus,select:focus{outline:none;border-color:#B8741A !important;box-shadow:0 0 0 3px rgba(184,116,26,0.12)}
      @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      .fade-up{animation:fadeUp 0.16s ease both}
      @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .shimmer{background:linear-gradient(90deg,#E8E0D0 25%,#F0E8DA 50%,#E8E0D0 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
      @keyframes modalIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
      .modal-in{animation:modalIn 0.14s ease}
      @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      .slide-down{animation:slideDown 0.18s ease}
      .accordion-hd{cursor:pointer;user-select:none;transition:background 0.12s}
      .accordion-hd:hover{background:rgba(184,116,26,0.06) !important}
      .del-btn:hover{background:rgba(200,60,60,0.15) !important;color:#C03030 !important;border-color:rgba(200,60,60,0.35) !important}
      .stat-bar{transition:opacity 0.15s}
      .stat-bar:hover{opacity:0.75 !important}
    `;
    document.head.appendChild(s);
  }, []);
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const out=[]; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){out.push(cur);cur='';}
    else cur+=c;
  }
  out.push(cur); return out;
}
function parseCSV(text) {
  const lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
  if(lines.length<2)return[];
  const hdrs=parseCSVLine(lines[0]).map(h=>h.trim());
  return lines.slice(1).map(line=>{
    const cols=parseCSVLine(line); const obj={};
    hdrs.forEach((h,i)=>{obj[h]=(cols[i]||'').trim();}); return obj;
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_MAP={'Book':'Books','Audiobook':'Audiobooks','TV Show':'TV Shows','Movie':'Movies','Video Game':'Games','Podcast':'Podcasts'};
const MEDIA_TABS=['Books','Audiobooks','TV Shows','Movies','Games','Podcasts'];
const TABS=['Activity Log',...MEDIA_TABS];
const TAB_ICON={'Activity Log':'📋',Books:'📖',Audiobooks:'🎧','TV Shows':'📺',Movies:'🎬',Games:'🎮',Podcasts:'🎙️'};
const CAT_CLR={Books:'#8B5CF6',Audiobooks:'#3B82F6','TV Shows':'#EF4444',Movies:'#F59E0B',Games:'#10B981',Podcasts:'#F97316',Other:'#9CA3AF'};
const CAT_BG={Books:'#F3F0FF',Audiobooks:'#EFF6FF','TV Shows':'#FFF5F5',Movies:'#FFFBEB',Games:'#ECFDF5',Podcasts:'#FFF7ED',Other:'#F9FAFB'};
const STATUSES=[
  {id:'want',        label:'Want',        bg:'#EFF6FF',text:'#2563EB',bdr:'#BFDBFE'},
  {id:'in-progress', label:'In Progress', bg:'#FFFBEB',text:'#B45309',bdr:'#FDE68A'},
  {id:'finished',    label:'Finished',    bg:'#F0FDF4',text:'#15803D',bdr:'#BBF7D0'},
];
const ST=Object.fromEntries(STATUSES.map(s=>[s.id,s]));
const STATUS_CYCLE={want:'in-progress','in-progress':'finished',finished:'want'};
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const countStars=s=>(s.match(/⭐/g)||[]).length;
const genId=()=>'i'+Date.now()+Math.random().toString(36).slice(2,6);
function parseSofaDate(str){
  if(!str)return 0; const p=str.split('/'); if(p.length!==3)return 0;
  const[m,d,y]=p.map(Number); return new Date(y<100?2000+y:y,m-1,d).getTime();
}
function getYear(dateStr){const ts=parseSofaDate(dateStr);return ts?new Date(ts).getFullYear():null;}
function getMonth(dateStr){const ts=parseSofaDate(dateStr);return ts?new Date(ts).getMonth():null;}
function cleanTitle(s){return(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');}

// Strip subtitles and parentheticals for cleaner search queries
// e.g. "Borders of Infinity: A Miles Vorkosigan Adventure (The Miles...)" → "Borders of Infinity"
function searchTitle(title) {
  return title
    .replace(/\s*\([^)]*\)/g, '')   // remove (parentheticals)
    .replace(/\s*\[[^\]]*\]/g, '')   // remove [brackets]
    .replace(/\s*:.*$/, '')           // remove everything after first colon
    .replace(/\s*-\s+.*$/, '')        // remove everything after " - "
    .trim();
}

function toItem(raw){
  const list=raw['List Name']||'';
  const sr=(raw['Status']||'').toLowerCase();
  const status=sr.includes('progress')?'in-progress':sr.includes('finish')||sr==='done'||sr==='completed'?'finished':list==='Activity'?'finished':'want';
  return{
    id:genId(), title:cleanTitle(raw['Item Title']), list,
    category:CAT_MAP[raw['Category']]||raw['Category']||'Other',
    dateAdded:raw['Date Added']||'',
    pinned:(raw['Pinned']||'').toLowerCase()==='true',
    rating:countStars(raw['Rating']||''),
    recBy:raw['Recommended By']||'', status, notes:raw['Notes']||'',
  };
}

// ─── Image Cache (two-tier: memory Map + localStorage) ───────────────────────
const IMG_CACHE_KEY = 'mySofa_imgCache_v2';
// Load persisted cache into a Map for O(1) in-memory lookups
const _memCache = new Map(
  Object.entries((() => { try { return JSON.parse(localStorage.getItem(IMG_CACHE_KEY)||'{}'); } catch { return {}; } })())
);
function getCached(key) {
  return _memCache.has(key) ? _memCache.get(key) : undefined;
}
function setCached(key, url) {
  _memCache.set(key, url);
  // Persist periodically - batch writes via debounce
  _schedulePersist();
}
let _persistTimer = null;
function _schedulePersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    try {
      const obj = Object.fromEntries(_memCache);
      localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(obj));
    } catch {}
    _persistTimer = null;
  }, 1500);
}

// ─── Metadata Cache (same two-tier pattern as image cache) ───────────────────
const META_CACHE_KEY = 'mySofa_metaCache_v1';
const _metaCache = new Map(
  Object.entries((() => { try { return JSON.parse(localStorage.getItem(META_CACHE_KEY)||'{}'); } catch { return {}; } })())
);
function getMetaCached(key) { return _metaCache.has(key) ? _metaCache.get(key) : undefined; }
function setMetaCached(key, val) {
  _metaCache.set(key, val);
  if (_metaPersistTimer) clearTimeout(_metaPersistTimer);
  _metaPersistTimer = setTimeout(() => {
    try { localStorage.setItem(META_CACHE_KEY, JSON.stringify(Object.fromEntries(_metaCache))); } catch {}
    _metaPersistTimer = null;
  }, 1500);
}
let _metaPersistTimer = null;

// ─── Per-domain parallel fetch pools ─────────────────────────────────────────
// Each domain gets its own concurrency limit and queue
// Priority items (visible cards) are unshifted to the front
const POOLS = {
  tmdb:        { concurrency: 8,  active: 0, queue: [] },
  googleBooks:  { concurrency: 6,  active: 0, queue: [] },
  itunes:       { concurrency: 6,  active: 0, queue: [] },
  openLibrary:  { concurrency: 3,  active: 0, queue: [] },
  rawg:         { concurrency: 4,  active: 0, queue: [] },
  steam:        { concurrency: 4,  active: 0, queue: [] },
};

function _runPool(pool) {
  while (pool.active < pool.concurrency && pool.queue.length > 0) {
    const { fn, resolve, reject } = pool.queue.shift();
    pool.active++;
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        pool.active--;
        _runPool(pool);
      });
  }
}

function poolFetch(domain, fn, priority = false) {
  const pool = POOLS[domain];
  return new Promise((resolve, reject) => {
    const task = { fn, resolve, reject };
    if (priority) pool.queue.unshift(task);
    else pool.queue.push(task);
    _runPool(pool);
  });
}

// ─── Cover Art Fetchers (one per source) ────────────────────────────────────
const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'; // w185 is plenty for 148px cards

async function _tmdbFetch(title, type) {
  if (!TMDB_TOKEN) return null;
  const enc = encodeURIComponent(searchTitle(title));
  const endpoint = type === 'movie' ? 'movie' : 'tv';
  const r = await fetch(
    `https://api.themoviedb.org/3/search/${endpoint}?query=${enc}&language=en-US&page=1`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  const d = await r.json();
  const p = d.results?.[0]?.poster_path;
  return p ? TMDB_IMG + p : null;
}

async function _googleBooksFetch(title) {
  // Most accurate for books — searches structured metadata
  const cleaned = searchTitle(title);
  const enc = encodeURIComponent(`intitle:${cleaned}`);
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${enc}&maxResults=1&fields=items(volumeInfo/imageLinks)`);
  const d = await r.json();
  const links = d.items?.[0]?.volumeInfo?.imageLinks;
  if (!links) return null;
  // Prefer thumbnail (128px), upgrade to zoom=1 for slightly sharper result
  const base = links.thumbnail || links.smallThumbnail;
  if (!base) return null;
  // Force https and bump zoom for better quality
  return base.replace('http://', 'https://').replace('zoom=1', 'zoom=2').replace('&edge=curl', '');
}

async function _openLibraryFetch(title) {
  const enc = encodeURIComponent(searchTitle(title));
  const r = await fetch(`https://openlibrary.org/search.json?title=${enc}&limit=1&fields=cover_i`);
  const d = await r.json();
  const covId = d.docs?.[0]?.cover_i;
  // Use -M size (just enough for our layout, smaller than -L)
  return covId ? `https://covers.openlibrary.org/b/id/${covId}-M.jpg` : null;
}

async function _itunesFetch(title, media, entity) {
  const enc = encodeURIComponent(searchTitle(title));
  const params = entity ? `entity=${entity}` : `media=${media}`;
  const r = await fetch(`https://itunes.apple.com/search?term=${enc}&${params}&limit=1`);
  const d = await r.json();
  const art = d.results?.[0]?.artworkUrl100;
  if (!art) return null;
  // 200x200 is plenty for our 148px card width; 300x300 was oversized
  return art.replace('100x100bb', '200x200bb');
}

async function _rawgFetch(title) {
  if (!RAWG_KEY) return null;
  const enc = encodeURIComponent(searchTitle(title));
  const r = await fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${enc}&page_size=1&search_precise=true`);
  const d = await r.json();
  return d.results?.[0]?.background_image || null;
}

async function _steamFetch(title) {
  // Search Steam store — no key needed
  const enc = encodeURIComponent(searchTitle(title));
  const r = await fetch(`https://store.steampowered.com/api/storesearch/?term=${enc}&l=en&cc=US`);
  const d = await r.json();
  const appid = d.items?.[0]?.id;
  if (!appid) return null;
  // Steam library portrait art (600×900) — ideal for our card aspect ratio
  return `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_600x900.jpg`;
}

// ─── Metadata Fetchers (on-demand, called when modal opens) ──────────────────

async function _tmdbMovieMeta(title) {
  if (!TMDB_TOKEN) return null;
  const enc = encodeURIComponent(searchTitle(title));
  const sr = await fetch(
    `https://api.themoviedb.org/3/search/movie?query=${enc}&language=en-US&page=1`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  const sd = await sr.json();
  const movie = sd.results?.[0];
  if (!movie) return null;
  // Second call for director from credits
  const cr = await fetch(
    `https://api.themoviedb.org/3/movie/${movie.id}/credits`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  const cd = await cr.json();
  const director = cd.crew?.find(c => c.job === 'Director')?.name || null;
  return {
    summary: movie.overview || null,
    creator: director, creatorLabel: 'Director',
    date: movie.release_date ? movie.release_date.slice(0,4) : null,
  };
}

async function _tmdbTvMeta(title) {
  if (!TMDB_TOKEN) return null;
  const enc = encodeURIComponent(searchTitle(title));
  const sr = await fetch(
    `https://api.themoviedb.org/3/search/tv?query=${enc}&language=en-US&page=1`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  const sd = await sr.json();
  const show = sd.results?.[0];
  if (!show) return null;
  // Second call for created_by from show details
  const dr = await fetch(
    `https://api.themoviedb.org/3/tv/${show.id}`,
    { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }
  );
  const dd = await dr.json();
  const creator = dd.created_by?.map(c => c.name).join(', ') || null;
  return {
    summary: show.overview || null,
    creator, creatorLabel: 'Created by',
    date: show.first_air_date ? show.first_air_date.slice(0,4) : null,
  };
}

async function _rawgMeta(title) {
  if (!RAWG_KEY) return null;
  const enc = encodeURIComponent(searchTitle(title));
  const sr = await fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${enc}&page_size=1&search_precise=true`);
  const sd = await sr.json();
  const game = sd.results?.[0];
  if (!game) return null;
  // Second call for full description and developer
  const dr = await fetch(`https://api.rawg.io/api/games/${game.id}?key=${RAWG_KEY}`);
  const dd = await dr.json();
  const raw = dd.description_raw || '';
  // Trim to ~450 chars at a sentence boundary if possible
  let summary = null;
  if (raw) {
    const trimmed = raw.slice(0, 450);
    const lastPeriod = trimmed.lastIndexOf('. ');
    summary = (lastPeriod > 80 ? trimmed.slice(0, lastPeriod + 1) : trimmed) + (raw.length > 450 ? '…' : '');
  }
  return {
    summary,
    creator: dd.developers?.[0]?.name || null, creatorLabel: 'Developer',
    date: game.released ? game.released.slice(0,4) : null,
  };
}

async function _steamMeta(title) {
  const enc = encodeURIComponent(searchTitle(title));
  const sr = await fetch(`https://store.steampowered.com/api/storesearch/?term=${enc}&l=en&cc=US`);
  const sd = await sr.json();
  const appid = sd.items?.[0]?.id;
  if (!appid) return null;
  const dr = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}`);
  const dd = await dr.json();
  const data = dd[appid]?.data;
  if (!data) return null;
  return {
    summary: data.short_description || null,
    creator: data.developers?.[0] || null, creatorLabel: 'Developer',
    date: data.release_date?.date || null,
  };
}

async function _googleBooksMeta(title) {
  const cleaned = searchTitle(title);
  const enc = encodeURIComponent(`intitle:${cleaned}`);
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${enc}&maxResults=1&fields=items(volumeInfo(description,authors,publishedDate))`);
  const d = await r.json();
  const info = d.items?.[0]?.volumeInfo;
  if (!info) return null;
  // Strip HTML tags that sometimes appear in Google Books descriptions
  const rawDesc = info.description || null;
  const summary = rawDesc ? rawDesc.replace(/<[^>]+>/g,'').slice(0,450) + (rawDesc.length > 450 ? '…' : '') : null;
  return {
    summary,
    creator: info.authors?.slice(0,3).join(', ') || null, creatorLabel: 'Author',
    date: info.publishedDate ? info.publishedDate.slice(0,4) : null,
  };
}

async function _openLibraryMeta(title) {
  const enc = encodeURIComponent(searchTitle(title));
  const r = await fetch(`https://openlibrary.org/search.json?title=${enc}&limit=1&fields=author_name,first_publish_year`);
  const d = await r.json();
  const doc = d.docs?.[0];
  if (!doc) return null;
  return {
    summary: null, // OL description requires a separate work fetch; skip for speed
    creator: doc.author_name?.slice(0,3).join(', ') || null, creatorLabel: 'Author',
    date: doc.first_publish_year ? String(doc.first_publish_year) : null,
  };
}

async function _itunesMeta(title, media, entity, creatorLabel) {
  const enc = encodeURIComponent(searchTitle(title));
  const params = entity ? `entity=${entity}` : `media=${media}`;
  const r = await fetch(`https://itunes.apple.com/search?term=${enc}&${params}&limit=1`);
  const d = await r.json();
  const item = d.results?.[0];
  if (!item) return null;
  const rawDesc = item.longDescription || item.description || null;
  const summary = rawDesc ? rawDesc.replace(/<[^>]+>/g,'').slice(0,450) + (rawDesc.length > 450 ? '…' : '') : null;
  return {
    summary,
    creator: item.artistName || null, creatorLabel,
    date: item.releaseDate ? item.releaseDate.slice(0,4) : null,
  };
}

async function fetchMetadata(title, category) {
  if (!title) return null;
  const key = `${category}::${title}`;
  const cached = getMetaCached(key);
  if (cached !== undefined) return cached;
  let meta = null;
  if (category === 'Movies') {
    meta = await _tmdbMovieMeta(title);
  } else if (category === 'TV Shows') {
    meta = await _tmdbTvMeta(title);
  } else if (category === 'Books') {
    meta = await _googleBooksMeta(title);
    // If no author found, try Open Library for author/date and merge
    if (!meta?.creator) {
      const ol = await _openLibraryMeta(title);
      if (ol) meta = { summary: meta?.summary || null, ...ol };
    }
  } else if (category === 'Audiobooks') {
    meta = await _itunesMeta(title, 'audiobook', null, 'Author');
    if (!meta) meta = await _googleBooksMeta(title);
  } else if (category === 'Podcasts') {
    meta = await _itunesMeta(title, 'podcast', null, 'By');
  } else if (category === 'Games') {
    meta = await _rawgMeta(title);
    if (!meta) meta = await _steamMeta(title);
  }
  setMetaCached(key, meta);
  return meta;
}

// ─── Main fetchCoverArt — orchestrates sources by category ───────────────────
async function fetchCoverArt(title, category, priority = false) {
  if (!title) return null;

  if (category === 'Movies') {
    // 1. TMDB (best for movies)
    const tmdb = await poolFetch('tmdb', () => _tmdbFetch(title, 'movie'), priority);
    if (tmdb) return tmdb;
    // 2. iTunes fallback
    return poolFetch('itunes', () => _itunesFetch(title, 'movie', null), priority);
  }

  if (category === 'TV Shows') {
    // 1. TMDB (best for TV)
    const tmdb = await poolFetch('tmdb', () => _tmdbFetch(title, 'tv'), priority);
    if (tmdb) return tmdb;
    // 2. iTunes fallback
    return poolFetch('itunes', () => _itunesFetch(title, 'tvShow', null), priority);
  }

  if (category === 'Books') {
    // 1. Google Books — most accurate title+metadata match
    const gb = await poolFetch('googleBooks', () => _googleBooksFetch(title), priority);
    if (gb) return gb;
    // 2. Open Library — good for classics and older titles
    const ol = await poolFetch('openLibrary', () => _openLibraryFetch(title), priority);
    if (ol) return ol;
    // 3. iTunes ebook — last resort
    return poolFetch('itunes', () => _itunesFetch(title, 'ebook', null), priority);
  }

  if (category === 'Audiobooks') {
    // 1. iTunes audiobook — most complete audiobook catalogue
    const it = await poolFetch('itunes', () => _itunesFetch(title, 'audiobook', null), priority);
    if (it) return it;
    // 2. Google Books (audiobook editions often listed)
    const gb = await poolFetch('googleBooks', () => _googleBooksFetch(title), priority);
    if (gb) return gb;
    // 3. Open Library
    return poolFetch('openLibrary', () => _openLibraryFetch(title), priority);
  }

  if (category === 'Podcasts') {
    return poolFetch('itunes', () => _itunesFetch(title, 'podcast', null), priority);
  }

  if (category === 'Games') {
    // 1. RAWG — best coverage: Switch, PlayStation, Xbox, PC, retro
    const rawg = await poolFetch('rawg', () => _rawgFetch(title), priority);
    if (rawg) return rawg;
    // 2. Steam — good PC/Mac portrait art
    const steam = await poolFetch('steam', () => _steamFetch(title), priority);
    if (steam) return steam;
    // 3. iTunes software — catches iOS/Mac mobile games
    return poolFetch('itunes', () => _itunesFetch(title, null, 'software'), priority);
  }

  return null;
}

// ─── useCoverArt hook with IntersectionObserver priority ────────────────────
function useCoverArt(title, category) {
  const key = `${category}::${title}`;
  const cached = getCached(key);
  const [url, setUrl] = useState(cached !== undefined ? cached : undefined);
  const [loading, setLoading] = useState(cached === undefined);
  const ref = useRef(null);
  const fetchedRef = useRef(false);

  const doFetch = useCallback((priority = false) => {
    if (fetchedRef.current || !title) return;
    fetchedRef.current = true;
    setLoading(true);
    fetchCoverArt(title, category, priority).then(result => {
      const val = result || null;
      setCached(key, val);
      setUrl(val);
      setLoading(false);
    });
  }, [title, category, key]);

  useEffect(() => {
    if (!title || url !== undefined) return;

    // Use IntersectionObserver — visible cards fetch with priority=true
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          obs.disconnect();
          doFetch(true); // priority fetch
        }
      }, { rootMargin: '200px' }); // start fetching 200px before visible
      if (ref.current) obs.observe(ref.current);
      return () => obs.disconnect();
    } else {
      // Fallback for browsers without IntersectionObserver
      doFetch(false);
    }
  }, [title, category, url, doFetch]);

  return { url, loading, ref };
}

// ─── Prefetch all items in background after import ───────────────────────────
// Called once after CSV import — fills cache without blocking UI
function prefetchAll(items) {
  // Stagger slightly so the UI renders first
  setTimeout(() => {
    items.forEach(item => {
      const key = `${item.category}::${item.title}`;
      if (!item.title || getCached(key) !== undefined) return;
      // Low-priority background fetch — visible cards will jump ahead
      fetchCoverArt(item.title, item.category, false).then(result => {
        setCached(key, result || null);
      });
    });
  }, 400);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Stars({n,size=12}){if(!n)return null;return<span style={{color:'#B8741A',fontSize:size,letterSpacing:-0.5,lineHeight:1}}>{'★'.repeat(n)}{'☆'.repeat(5-n)}</span>;}
function StarPicker({value,onChange}){
  const[h,setH]=useState(0);
  return(<div style={{display:'flex',gap:4}}>{[1,2,3,4,5].map(n=><span key={n} onClick={()=>onChange(n===value?0:n)} onMouseEnter={()=>setH(n)} onMouseLeave={()=>setH(0)} style={{fontSize:26,color:n<=(h||value)?'#B8741A':'#D4C4A8',cursor:'pointer',transition:'color 0.1s,transform 0.1s',transform:n<=(h||value)?'scale(1.1)':'scale(1)'}}>★</span>)}</div>);
}
function Badge({status,onClick,sm}){
  const s=ST[status]||ST.want;
  return(<span onClick={onClick} className={onClick?'status-cycle':''} style={{background:s.bg,color:s.text,border:`1px solid ${s.bdr}`,borderRadius:20,padding:sm?'2px 8px':'3px 10px',fontSize:sm?11:12,fontWeight:600,cursor:onClick?'pointer':'default',userSelect:'none',whiteSpace:'nowrap'}}>{s.label}</span>);
}
function CoverPlaceholder({category,title}){
  return(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,background:CAT_BG[category]||'#F5F5F5'}}><span style={{fontSize:30,opacity:0.4}}>{TAB_ICON[category]||'◈'}</span><div style={{fontSize:11,color:CAT_CLR[category]||'#888',fontWeight:600,textAlign:'center',padding:'0 8px',lineHeight:1.35,opacity:0.7,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>{title}</div></div>);
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({item,onClick,onStatusChange}){
  const{url,loading,ref}=useCoverArt(item.title,item.category);
  const[imgErr,setImgErr]=useState(false);
  const showPlaceholder=!loading&&(!url||imgErr);
  return(
    <div ref={ref} className="card-hover fade-up" onClick={()=>onClick(item)}
      style={{background:'#FFFFFF',border:'1px solid #E8DFCE',borderRadius:12,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
      <div style={{position:'relative',width:'100%',paddingTop:'148%',background:'#F0EAE0',flexShrink:0}}>
        <div style={{position:'absolute',inset:0}}>
          {loading&&<div className="shimmer" style={{width:'100%',height:'100%'}}/>}
          {showPlaceholder&&<CoverPlaceholder category={item.category} title={item.title}/>}
          {!loading&&url&&!imgErr&&<img src={url} alt={item.title} onError={()=>setImgErr(true)} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} loading="lazy"/>}
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:'50%',background:'linear-gradient(to top,rgba(255,252,246,0.96) 0%,rgba(255,252,246,0.5) 55%,transparent 100%)',pointerEvents:'none'}}/>
          {item.pinned&&<div style={{position:'absolute',top:7,right:8,fontSize:12,color:'#B8741A'}}>⊞</div>}
          <div style={{position:'absolute',bottom:8,left:8}}><Badge status={item.status} sm onClick={e=>{e.stopPropagation();onStatusChange(item.id,STATUS_CYCLE[item.status]);}}/></div>
          {item.rating>0&&<div style={{position:'absolute',bottom:9,right:8}}><Stars n={item.rating} size={11}/></div>}
        </div>
      </div>
      <div style={{padding:'9px 10px 11px',display:'flex',flexDirection:'column',gap:3}}>
        <div style={{fontSize:13,fontWeight:600,color:'#1E1810',lineHeight:1.35,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{item.title}</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
          <span style={{fontSize:11,color:'#9A8E7A',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'70%'}}>{item.list&&item.list!=='Activity'?item.list:''}</span>
          <div style={{display:'flex',gap:5,alignItems:'center',flexShrink:0}}>
            {item.recBy&&<span title={`Rec'd by ${item.recBy}`} style={{fontSize:11,color:'#B8A898'}}>👤</span>}
            {item.notes&&<span title={item.notes} style={{fontSize:11,color:'#B8A898'}}>✎</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardGrid({items,onItemClick,onStatusChange}){
  if(!items.length)return null;
  return(<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))',gap:10}}>{items.map(item=><Card key={item.id} item={item} onClick={onItemClick} onStatusChange={onStatusChange}/>)}</div>);
}

function AccordionGroup({title,items,onItemClick,onStatusChange}){
  const[open,setOpen]=useState(false);
  return(
    <div style={{border:'1px solid #E0D5C5',borderRadius:12,overflow:'hidden',marginBottom:10}}>
      <div className="accordion-hd" onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',background:open?'rgba(184,116,26,0.04)':'#FDFAF5'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:14,fontWeight:700,color:'#2A1E10'}}>{title}</span>
          <span style={{fontSize:12,color:'#B8741A',background:'rgba(184,116,26,0.1)',borderRadius:10,padding:'1px 8px',fontWeight:600}}>{items.length}</span>
        </div>
        <span style={{fontSize:16,color:'#9A8068',transition:'transform 0.2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>⌄</span>
      </div>
      {open&&<div style={{padding:'12px 12px 14px',background:'#FDFBF7',borderTop:'1px solid #EDE5D5'}}><CardGrid items={items} onItemClick={onItemClick} onStatusChange={onStatusChange}/></div>}
    </div>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────
function Tooltip({text,x,y,visible}){
  if(!visible)return null;
  return(<g><rect x={x-54} y={y-30} width={108} height={22} rx={5} fill="#2A1E10" opacity={0.88}/><text x={x} y={y-15} textAnchor="middle" fill="#FFF8EE" fontSize={11} fontFamily="DM Sans,sans-serif">{text}</text></g>);
}
function StackedBarChart({data,years,cats,maxVal,height=220}){
  const[tip,setTip]=useState(null);
  const ML=44,MR=16,MT=16,MB=36;
  const W=600,H=height; const cW=W-ML-MR,cH=H-MT-MB;
  const n=years.length; const bW=Math.min(40,Math.floor(cW/n*0.65));
  const gap=(cW-(bW*n))/(n+1);
  const tickStep=Math.ceil(maxVal/5/5)*5||1;
  const ticks=[];for(let t=0;t<=maxVal;t+=tickStep)ticks.push(t);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}} onMouseLeave={()=>setTip(null)}>
      {ticks.map(t=>{const yy=MT+cH-(t/maxVal)*cH;return<g key={t}><line x1={ML} y1={yy} x2={ML+cW} y2={yy} stroke="#E8DFCE" strokeWidth={1} strokeDasharray={t===0?"none":"3,3"}/><text x={ML-6} y={yy+4} textAnchor="end" fontSize={10} fill="#9A8878" fontFamily="DM Sans,sans-serif">{t}</text></g>;})}
      {years.map((yr,i)=>{
        const x=ML+gap+(bW+gap)*i; let cumY=0;
        const activeCats=cats.filter(c=>(data[yr]?.[c]||0)>0);
        const rects=activeCats.map(c=>{
          const val=data[yr]?.[c]||0; const bH=(val/maxVal)*cH; const yy=MT+cH-cumY-bH; cumY+=bH;
          const total=cats.reduce((s,cc)=>s+(data[yr]?.[cc]||0),0);
          return<rect key={c} x={x} y={yy} width={bW} height={Math.max(bH,0)} fill={CAT_CLR[c]||'#888'} rx={c===activeCats.slice(-1)[0]?3:0} className="stat-bar" onMouseEnter={()=>setTip({text:`${c}: ${val} of ${total}`,x:x+bW/2,y:yy})}/>;
        });
        const total=cats.reduce((s,c)=>s+(data[yr]?.[c]||0),0);
        return(<g key={yr}>{rects}{total>0&&<text x={x+bW/2} y={MT+cH-cumY-5} textAnchor="middle" fontSize={10} fill="#5A4A38" fontFamily="DM Sans,sans-serif" fontWeight={600}>{total}</text>}<text x={x+bW/2} y={MT+cH+16} textAnchor="middle" fontSize={11} fill="#7A6858" fontFamily="DM Sans,sans-serif">{yr}</text></g>);
      })}
      <line x1={ML} y1={MT} x2={ML} y2={MT+cH} stroke="#D0C4B0" strokeWidth={1}/>
      <line x1={ML} y1={MT+cH} x2={ML+cW} y2={MT+cH} stroke="#D0C4B0" strokeWidth={1}/>
      {tip&&<Tooltip text={tip.text} x={tip.x} y={tip.y} visible={true}/>}
    </svg>
  );
}
function MonthBarChart({data,currentYear,maxVal,height=180}){
  const[tip,setTip]=useState(null);
  const ML=44,MR=16,MT=16,MB=36;
  const W=600,H=height; const cW=W-ML-MR,cH=H-MT-MB;
  const bW=Math.floor(cW/12*0.65); const gap=(cW-(bW*12))/(12+1);
  const cats=MEDIA_TABS;
  const tickStep=Math.ceil(maxVal/4)||1; const ticks=[];for(let t=0;t<=maxVal;t+=tickStep)ticks.push(t);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}} onMouseLeave={()=>setTip(null)}>
      {ticks.map(t=>{const yy=MT+cH-(t/Math.max(maxVal,1))*cH;return<g key={t}><line x1={ML} y1={yy} x2={ML+cW} y2={yy} stroke="#E8DFCE" strokeWidth={1} strokeDasharray={t===0?"none":"3,3"}/><text x={ML-6} y={yy+4} textAnchor="end" fontSize={10} fill="#9A8878" fontFamily="DM Sans,sans-serif">{t}</text></g>;})}
      {MONTHS.map((mo,i)=>{
        const x=ML+gap+(bW+gap)*i; let cumY=0;
        const total=cats.reduce((s,c)=>s+(data[i]?.[c]||0),0);
        const rects=cats.filter(c=>(data[i]?.[c]||0)>0).map(c=>{
          const val=data[i]?.[c]||0; const bH=(val/Math.max(maxVal,1))*cH; const yy=MT+cH-cumY-bH; cumY+=bH;
          return<rect key={c} x={x} y={yy} width={bW} height={Math.max(bH,0)} fill={CAT_CLR[c]||'#888'} rx={0} className="stat-bar" onMouseEnter={()=>setTip({text:`${mo}: ${total} item${total!==1?'s':''}`,x:x+bW/2,y:yy})}/>;
        });
        const now=new Date(); const isNow=i===now.getMonth()&&currentYear===now.getFullYear();
        return(<g key={mo} onMouseLeave={()=>setTip(null)}>{isNow&&<rect x={x-2} y={MT} width={bW+4} height={cH} fill="rgba(184,116,26,0.06)" rx={3}/>}{rects}{total>0&&<text x={x+bW/2} y={MT+cH-cumY-4} textAnchor="middle" fontSize={9} fill="#5A4A38" fontFamily="DM Sans,sans-serif" fontWeight={600}>{total}</text>}<text x={x+bW/2} y={MT+cH+16} textAnchor="middle" fontSize={10} fill={isNow?'#B8741A':'#7A6858'} fontFamily="DM Sans,sans-serif" fontWeight={isNow?700:400}>{mo}</text></g>);
      })}
      <line x1={ML} y1={MT} x2={ML} y2={MT+cH} stroke="#D0C4B0" strokeWidth={1}/>
      <line x1={ML} y1={MT+cH} x2={ML+cW} y2={MT+cH} stroke="#D0C4B0" strokeWidth={1}/>
      {tip&&<Tooltip text={tip.text} x={tip.x} y={tip.y} visible={true}/>}
    </svg>
  );
}
function Legend({cats}){
  return(<div style={{display:'flex',flexWrap:'wrap',gap:'6px 14px',marginBottom:12}}>{cats.map(c=><div key={c} style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:10,height:10,borderRadius:2,background:CAT_CLR[c]||'#888',flexShrink:0}}/><span style={{fontSize:12,color:'#6A5E48'}}>{c}</span></div>)}</div>);
}
function StatCard({label,value,sub}){
  return(<div style={{background:'#FFFFFF',border:'1px solid #E8DFCE',borderRadius:12,padding:'16px 20px',flex:'1 1 120px',minWidth:110}}><div style={{fontSize:26,fontWeight:700,color:'#2A1E10',fontFamily:"'Lora',serif",lineHeight:1}}>{value}</div><div style={{fontSize:12.5,color:'#7A6858',marginTop:5,fontWeight:500}}>{label}</div>{sub&&<div style={{fontSize:11,color:'#A09080',marginTop:3}}>{sub}</div>}</div>);
}
function StatsPanel({items,onClose}){
  const currentYear=new Date().getFullYear();
  const finished=useMemo(()=>items.filter(i=>i.status==='finished'&&i.dateAdded),[items]);
  const totalFinished=finished.length;
  const thisYear=finished.filter(i=>getYear(i.dateAdded)===currentYear).length;
  const topCat=useMemo(()=>{const c={};finished.forEach(i=>{c[i.category]=(c[i.category]||0)+1;});return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]||['—',0];},[finished]);
  const avgRating=useMemo(()=>{const rated=finished.filter(i=>i.rating>0);if(!rated.length)return'—';return(rated.reduce((s,i)=>s+i.rating,0)/rated.length).toFixed(1);},[finished]);
  const years=useMemo(()=>[...new Set(finished.map(i=>getYear(i.dateAdded)).filter(Boolean))].sort(),[finished]);
  const byYearCat=useMemo(()=>{const d={};finished.forEach(i=>{const y=getYear(i.dateAdded);if(!y)return;if(!d[y])d[y]={};d[y][i.category]=(d[y][i.category]||0)+1;});return d;},[finished]);
  const yearMax=useMemo(()=>Math.max(...years.map(y=>MEDIA_TABS.reduce((s,c)=>s+(byYearCat[y]?.[c]||0),0)),1),[years,byYearCat]);
  const byMonth=useMemo(()=>{const d=Array(12).fill(null).map(()=>({}));finished.forEach(i=>{const y=getYear(i.dateAdded);const m=getMonth(i.dateAdded);if(y===currentYear&&m!=null){d[m][i.category]=(d[m][i.category]||0)+1;}});return d;},[finished,currentYear]);
  const monthMax=useMemo(()=>Math.max(...byMonth.map(m=>MEDIA_TABS.reduce((s,c)=>s+(m[c]||0),0)),1),[byMonth]);
  const activeCats=useMemo(()=>MEDIA_TABS.filter(c=>finished.some(i=>i.category===c)),[finished]);
  return(
    <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',flexDirection:'column'}} onClick={onClose}>
      <div style={{position:'absolute',inset:0,background:'rgba(30,20,10,0.35)'}}/>
      <div className="slide-down" onClick={e=>e.stopPropagation()} style={{position:'relative',background:'#F4EEE4',borderBottom:'2px solid #D0C4B0',maxHeight:'88vh',overflowY:'auto',boxShadow:'0 12px 48px rgba(0,0,0,0.18)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 24px',borderBottom:'1px solid #DDD0BE',background:'rgba(244,238,228,0.97)',position:'sticky',top:0,zIndex:10}}>
          <span style={{fontFamily:"'Lora',serif",fontSize:18,fontWeight:700,color:'#2A1E10'}}>📊 Stats</span>
          <button onClick={onClose} style={{background:'rgba(184,116,26,0.1)',border:'1px solid #D0C4B0',color:'#7A6E58',cursor:'pointer',fontSize:14,fontWeight:600,padding:'8px 16px',borderRadius:8,fontFamily:'inherit',lineHeight:1}}>✕ Close</button>
        </div>
        <div style={{padding:'20px 24px 30px'}}>
          {totalFinished===0?(
            <div style={{textAlign:'center',padding:'40px 20px',color:'#A09080'}}><div style={{fontSize:32,marginBottom:10,opacity:0.4}}>📊</div><div style={{fontSize:14}}>Import your Sofa CSV to see stats</div></div>
          ):(
            <>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:28}}>
                <StatCard label="Total finished" value={totalFinished.toLocaleString()}/>
                <StatCard label={`Finished in ${currentYear}`} value={thisYear} sub="so far"/>
                <StatCard label="Most consumed" value={topCat[0]} sub={`${topCat[1]} items`}/>
                <StatCard label="Avg rating" value={avgRating} sub="of rated items"/>
              </div>
              <div style={{marginBottom:30}}>
                <h3 style={{fontFamily:"'Lora',serif",fontSize:16,fontWeight:700,color:'#2A1E10',marginBottom:14}}>Finished by Year</h3>
                <Legend cats={activeCats}/>
                <div style={{background:'#FFFFFF',border:'1px solid #E8DFCE',borderRadius:14,padding:'16px 12px 8px',boxShadow:'0 1px 6px rgba(0,0,0,0.05)'}}><StackedBarChart data={byYearCat} years={years} cats={activeCats} maxVal={yearMax}/></div>
              </div>
              <div>
                <h3 style={{fontFamily:"'Lora',serif",fontSize:16,fontWeight:700,color:'#2A1E10',marginBottom:14}}>
                  Pace in {currentYear}
                  <span style={{fontSize:12,fontWeight:400,color:'#9A8878',marginLeft:10,fontFamily:"'DM Sans',sans-serif"}}>items finished per month</span>
                </h3>
                <Legend cats={activeCats}/>
                <div style={{background:'#FFFFFF',border:'1px solid #E8DFCE',borderRadius:14,padding:'16px 12px 8px',boxShadow:'0 1px 6px rgba(0,0,0,0.05)'}}><MonthBarChart data={byMonth} currentYear={currentYear} maxVal={monthMax}/></div>
              </div>
            </>
          )}
          <div style={{textAlign:'center',paddingTop:24}}>
            <button onClick={onClose} style={{background:'rgba(184,116,26,0.1)',border:'1.5px solid #D0C4B0',color:'#7A6E58',borderRadius:10,padding:'12px 36px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>✕ Close Stats</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Category View ────────────────────────────────────────────────────────────
function CategoryView({items,category,search,onItemClick,onStatusChange}){
  const catItems=useMemo(()=>{
    const base=items.filter(i=>i.category===category&&i.status!=='finished');
    return search?base.filter(i=>i.title.toLowerCase().includes(search.toLowerCase())):base;
  },[items,category,search]);
  const inProgress=useMemo(()=>catItems.filter(i=>i.status==='in-progress').sort((a,b)=>parseSofaDate(b.dateAdded)-parseSofaDate(a.dateAdded)),[catItems]);
  const groups=useMemo(()=>{
    const g={};
    catItems.filter(i=>i.status==='want').forEach(item=>{
      const k=item.list&&item.list!=='Activity'?item.list:'Uncategorized';
      if(!g[k])g[k]=[];g[k].push(item);
    });
    Object.values(g).forEach(arr=>arr.sort((a,b)=>a.pinned!==b.pinned?a.pinned?-1:1:parseSofaDate(b.dateAdded)-parseSofaDate(a.dateAdded)));
    return g;
  },[catItems]);
  const verb=category==='Books'||category==='Audiobooks'?'Read':category==='Games'?'Play':'Watch';
  const hasContent=inProgress.length>0||Object.keys(groups).length>0;
  if(!hasContent)return(<div style={{textAlign:'center',padding:'60px 20px',color:'#A09080'}}><div style={{fontSize:32,marginBottom:10,opacity:0.4}}>{TAB_ICON[category]}</div><div style={{fontSize:14}}>{search?`No ${category.toLowerCase()} matching "${search}"`:`No ${category.toLowerCase()} on your list yet`}</div></div>);
  return(
    <div>
      {inProgress.length>0&&(
        <div style={{marginBottom:22}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:700,color:'#B45309',letterSpacing:0.3,textTransform:'uppercase'}}>In Progress</span>
            <span style={{fontSize:12,color:'#B8741A',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:10,padding:'1px 8px',fontWeight:600}}>{inProgress.length}</span>
          </div>
          <CardGrid items={inProgress} onItemClick={onItemClick} onStatusChange={onStatusChange}/>
        </div>
      )}
      {Object.keys(groups).length>0&&(
        <div>
          {inProgress.length>0&&(
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <span style={{fontSize:13,fontWeight:700,color:'#4A3C2A',letterSpacing:0.3,textTransform:'uppercase'}}>Want to {verb}</span>
              <span style={{fontSize:12,color:'#7A6E5A',background:'#F0E8D8',borderRadius:10,padding:'1px 8px',fontWeight:600}}>{Object.values(groups).reduce((s,a)=>s+a.length,0)}</span>
            </div>
          )}
          {Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([n,its])=><AccordionGroup key={n} title={n} items={its} onItemClick={onItemClick} onStatusChange={onStatusChange}/>)}
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
  const counts=useMemo(()=>{const all=items.filter(i=>i.status==='finished');const c={all:all.length};MEDIA_TABS.forEach(t=>{c[t]=all.filter(i=>i.category===t).length;});return c;},[items]);
  const ps=active=>({background:active?'rgba(184,116,26,0.12)':'transparent',border:`1px solid ${active?'#B8741A':'#D8CCBC'}`,color:active?'#92540A':'#6A5E48',borderRadius:20,padding:'4px 12px',fontSize:12.5,cursor:'pointer',fontFamily:'inherit',fontWeight:active?600:400,transition:'all 0.12s',whiteSpace:'nowrap'});
  return(
    <div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
        <button style={ps(catFilt==='all')} onClick={()=>setCatFilt('all')}>All ({counts.all})</button>
        {MEDIA_TABS.filter(t=>counts[t]>0).map(t=><button key={t} style={ps(catFilt===t)} onClick={()=>setCatFilt(catFilt===t?'all':t)}>{TAB_ICON[t]} {t} ({counts[t]})</button>)}
      </div>
      {finished.length===0?(<div style={{textAlign:'center',padding:'60px 20px',color:'#A09080'}}><div style={{fontSize:32,marginBottom:10,opacity:0.4}}>📋</div><div style={{fontSize:14}}>{search?`Nothing matching "${search}"`:'Nothing in your Activity Log yet'}</div></div>):(
        <><div style={{fontSize:12,color:'#A09080',marginBottom:12}}>{finished.length.toLocaleString()} item{finished.length!==1?'s':''}</div><CardGrid items={finished} onItemClick={onItemClick} onStatusChange={onStatusChange}/></>
      )}
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function Modal({item,items,onSave,onDelete,onClose}){
  const isNew=!item.id;
  const[form,setForm]=useState({title:'',list:'',category:'Books',status:'want',rating:0,recBy:'',notes:'',pinned:false,dateAdded:'',...item});
  const[confirmDelete,setConfirmDelete]=useState(false);
  const existingLists=useMemo(()=>{const s=new Set();(items||[]).forEach(i=>{if(i.list&&i.list!=='Activity')s.add(i.list);});return[...s].sort();},[items]);
  const[newListMode,setNewListMode]=useState(false);
  const[meta,setMeta]=useState(undefined); // undefined=loading, null=not found, obj=found
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    if(!item.id||!item.title)return; // don't fetch for new items
    fetchMetadata(item.title,item.category).then(setMeta);
  },[item.id,item.title,item.category]);
  const inp={background:'#FDFAF5',border:'1px solid #D8CCBC',borderRadius:8,color:'#1E1810',padding:'9px 12px',fontSize:14,width:'100%',fontFamily:'inherit'};
  const lbl={fontSize:11.5,color:'#7A6E56',fontWeight:600,letterSpacing:0.5,textTransform:'uppercase',marginBottom:5,display:'block'};
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(30,20,10,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div className="modal-in" onClick={e=>e.stopPropagation()} style={{background:'#FFFCF6',border:'1px solid #DDD0BE',borderRadius:18,padding:28,width:'100%',maxWidth:480,maxHeight:'92vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:18,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontFamily:"'Lora',serif",fontSize:20,fontWeight:700,color:'#1E1810'}}>{isNew?'✦ Add Item':'✦ Edit Item'}</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#9A8E76',cursor:'pointer',fontSize:20,lineHeight:1,padding:4}}>✕</button>
        </div>
        <div><label style={lbl}>Title</label><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Item title…" style={inp} autoFocus/></div>
        {/* ── Metadata card (existing items only) ── */}
        {!isNew&&(
          <div style={{background:'#F7F2EA',border:'1px solid #E8DFCE',borderRadius:12,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
            {meta===undefined?(
              // Loading shimmer
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div className="shimmer" style={{height:13,width:'45%',borderRadius:6}}/>
                <div className="shimmer" style={{height:12,width:'100%',borderRadius:6}}/>
                <div className="shimmer" style={{height:12,width:'80%',borderRadius:6}}/>
              </div>
            ):meta===null?(
              <div style={{fontSize:12.5,color:'#A09080',fontStyle:'italic'}}>No metadata found for this title.</div>
            ):(
              <>
                {(meta.creator||meta.date)&&(
                  <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                    {meta.creator&&<div><span style={{fontSize:11,color:'#9A8878',fontWeight:600,textTransform:'uppercase',letterSpacing:0.4}}>{meta.creatorLabel} </span><span style={{fontSize:13,color:'#2A1E10',fontWeight:500}}>{meta.creator}</span></div>}
                    {meta.date&&<div><span style={{fontSize:11,color:'#9A8878',fontWeight:600,textTransform:'uppercase',letterSpacing:0.4}}>Year </span><span style={{fontSize:13,color:'#2A1E10',fontWeight:500}}>{meta.date}</span></div>}
                  </div>
                )}
                {meta.summary&&<p style={{fontSize:13,color:'#4A3C2A',lineHeight:1.65,margin:0}}>{meta.summary}</p>}
              </>
            )}
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div><label style={lbl}>Category</label><select value={form.category} onChange={e=>set('category',e.target.value)} style={{...inp,cursor:'pointer'}}>{['Books','Audiobooks','TV Shows','Movies','Games','Podcasts'].map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label style={lbl}>Status</label><select value={form.status} onChange={e=>set('status',e.target.value)} style={{...inp,cursor:'pointer'}}>{STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        </div>
        <div><label style={lbl}>Rating {form.rating>0&&<span style={{color:'#B8741A',textTransform:'none',letterSpacing:0,fontWeight:400}}>— {form.rating} star{form.rating!==1?'s':''}</span>}</label><StarPicker value={form.rating} onChange={v=>set('rating',v)}/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div>
            <label style={lbl}>List / Source</label>
            {existingLists.length>0?(
              <>
                <select value={newListMode?'＋':(form.list||'')} onChange={e=>{if(e.target.value==='＋'){setNewListMode(true);set('list','');}else{setNewListMode(false);set('list',e.target.value);}}} style={{...inp,cursor:'pointer',marginBottom:newListMode?8:0}}>
                  <option value="">— No list —</option>
                  {existingLists.map(l=><option key={l} value={l}>{l}</option>)}
                  <option value="＋">＋ New list…</option>
                </select>
                {newListMode&&<input value={form.list} onChange={e=>set('list',e.target.value)} placeholder="New list name…" style={inp} autoFocus/>}
              </>
            ):(
              <input value={form.list} onChange={e=>set('list',e.target.value)} placeholder="e.g. Netflix, To Read…" style={inp}/>
            )}
          </div>
          <div><label style={lbl}>Recommended By</label><input value={form.recBy} onChange={e=>set('recBy',e.target.value)} placeholder="Who rec'd it?" style={inp}/></div>
        </div>
        <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Thoughts, season notes, reminders…" rows={3} style={{...inp,resize:'vertical',lineHeight:1.55}}/></div>
        <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}><input type="checkbox" checked={form.pinned} onChange={e=>set('pinned',e.target.checked)} style={{accentColor:'#B8741A',width:15,height:15,cursor:'pointer'}}/><span style={{fontSize:13,color:'#6A5E48'}}>Pin to top</span></label>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,paddingTop:4}}>
          <div>
            {!isNew&&!confirmDelete&&<button className="del-btn" onClick={()=>setConfirmDelete(true)} style={{background:'rgba(180,50,50,0.07)',border:'1px solid rgba(180,50,50,0.2)',color:'#A03030',borderRadius:8,padding:'8px 14px',fontSize:13,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s'}}>Delete</button>}
            {confirmDelete&&<div style={{display:'flex',gap:6,alignItems:'center'}}><span style={{fontSize:12.5,color:'#A03030'}}>Sure?</span><button onClick={()=>onDelete(item.id)} style={{background:'rgba(180,50,50,0.15)',border:'1px solid rgba(180,50,50,0.3)',color:'#C03030',borderRadius:7,padding:'6px 12px',fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>Yes, delete</button><button onClick={()=>setConfirmDelete(false)} style={{background:'transparent',border:'1px solid #D0C4B0',color:'#7A6E56',borderRadius:7,padding:'6px 10px',fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button></div>}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{background:'transparent',border:'1px solid #D0C4B0',color:'#7A6E56',borderRadius:9,padding:'9px 17px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
            <button onClick={()=>form.title.trim()&&onSave(form)} style={{background:form.title.trim()?'#B8741A':'#D0C4B0',border:'none',color:form.title.trim()?'#FFF8EE':'#9A8E76',borderRadius:9,padding:'9px 22px',fontSize:13,fontWeight:700,cursor:form.title.trim()?'pointer':'default',fontFamily:'inherit',transition:'background 0.12s'}}>{isNew?'Add Item':'Save'}</button>
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
  const[modal,setModal]=useState(null);
  const[showStats,setShowStats]=useState(false);
  const fileRef=useRef();

  useEffect(()=>{try{localStorage.setItem('mySofa_v1',JSON.stringify(items));}catch{}},[items]);

  // Prefetch covers for all items on first load if cache is cold
  useEffect(()=>{
    if(items.length>0) prefetchAll(items);
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear cached nulls for Games so the new fetchers get a chance to run
  useEffect(()=>{
    items.filter(i=>i.category==='Games').forEach(i=>{
      const key=`Games::${i.title}`;
      if(_memCache.get(key)===null){_memCache.delete(key);_schedulePersist();}
    });
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImport=e=>{
    const file=e.target.files[0];if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{
      const newItems=parseCSV(ev.target.result).filter(r=>r['Item Title']?.trim()).map(toItem);
      setItems(newItems);
      prefetchAll(newItems); // kick off background fetch immediately on import
    };
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
      if(prev&&(prev.title!==form.title||prev.category!==form.category)){
        // Clear cached image if title/category changed so it refetches
        const oldKey=`${prev.category}::${prev.title}`;
        _memCache.delete(oldKey);
        _schedulePersist();
      }
      setItems(p=>p.map(i=>i.id===form.id?{...form}:i));
    }else{
      const today=new Date();
      const newItem={...form,id:genId(),dateAdded:`${today.getMonth()+1}/${today.getDate()}/${String(today.getFullYear()).slice(2)}`};
      setItems(p=>[newItem,...p]);
      // Prefetch the new item's cover immediately
      prefetchAll([newItem]);
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
      <header style={{borderBottom:'1px solid #DDD0BE',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'rgba(244,238,228,0.97)',backdropFilter:'blur(10px)',zIndex:300,boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10}}>
          <span style={{fontFamily:"'Lora',serif",fontSize:22,fontWeight:700,color:'#2A1E10',letterSpacing:-0.3}}>✦ MySofa</span>
          {items.length>0&&<span style={{fontSize:12,color:'#A09080'}}>{items.length.toLocaleString()} items</span>}
        </div>
        <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} style={{display:'none'}}/>
          {items.length>0&&<button className="ghost-btn" onClick={()=>setShowStats(s=>!s)} style={{background:showStats?'rgba(184,116,26,0.1)':'transparent',border:`1px solid ${showStats?'#B8741A':'#D0C4B0'}`,color:showStats?'#92540A':'#7A6E58',borderRadius:8,padding:'7px 13px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:showStats?600:400}}>📊 Stats</button>}
          <button className="ghost-btn" onClick={()=>fileRef.current.click()} style={{background:'transparent',border:'1px solid #D0C4B0',color:'#7A6E58',borderRadius:8,padding:'7px 13px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>↑ Import CSV</button>
          {items.length>0&&<button className="ghost-btn" onClick={handleExport} style={{background:'transparent',border:'1px solid #D0C4B0',color:'#7A6E58',borderRadius:8,padding:'7px 13px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>↓ Export</button>}
          <button onClick={()=>setModal({item:{}})} style={{background:'#B8741A',border:'none',color:'#FFF8EE',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>+ Add</button>
        </div>
      </header>

      {showStats&&<StatsPanel items={items} onClose={()=>setShowStats(false)}/>}

      {/* Tabs */}
      <div style={{borderBottom:'1px solid #DDD0BE',padding:'0 20px',display:'flex',gap:0,overflowX:'auto',background:'rgba(244,238,228,0.8)'}}>
        {TABS.map(t=>(
          <button key={t} className="tab-btn" onClick={()=>{setTab(t);setSearch('');}}
            style={{background:'none',border:'none',borderBottom:tab===t?'2.5px solid #B8741A':'2.5px solid transparent',color:tab===t?'#92540A':'#7A6E58',padding:'12px 13px 10px',fontSize:13.5,cursor:'pointer',fontFamily:'inherit',fontWeight:tab===t?700:400,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
            <span>{TAB_ICON[t]}</span>{t}
            {tabCounts[t]>0&&<span style={{fontSize:11,padding:'1px 6px',borderRadius:10,background:tab===t?'rgba(184,116,26,0.15)':'rgba(0,0,0,0.05)',color:tab===t?'#92540A':'#9A8878'}}>{tabCounts[t]}</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      {items.length>0&&(
        <div style={{padding:'10px 20px',display:'flex',gap:8,alignItems:'center',borderBottom:'1px solid #EAE0D0',background:'rgba(252,248,242,0.8)'}}>
          <div style={{position:'relative',flex:'1 1 200px'}}>
            <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'#B8A898',fontSize:15,pointerEvents:'none'}}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab==='Activity Log'?'activity log':tab.toLowerCase()}…`} style={{background:'#FFFFFF',border:'1px solid #DDD0BE',borderRadius:8,color:'#1E1810',padding:'8px 11px 8px 32px',fontSize:13.5,width:'100%',fontFamily:'inherit'}}/>
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
            <div style={{fontSize:15,color:'#7A6E58',marginBottom:30,lineHeight:1.7,maxWidth:360,margin:'0 auto 30px'}}>Import your Sofa CSV export to bring in all your books, shows, games and more — or start fresh by adding items manually.</div>
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

      {modal&&<Modal item={modal.item} items={items} onSave={saveItem} onDelete={deleteItem} onClose={()=>setModal(null)}/>}
    </div>
  );
}
