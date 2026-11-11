// Lấy tin từ RSS các nguồn uy tín -> public/news.json (không cần thư viện ngoài, Node 18+)
import { writeFile, mkdir } from 'node:fs/promises';

const FEEDS = {
  vietnam: [
    ['VnExpress', 'https://vnexpress.net/rss/tin-moi-nhat.rss'],
    ['Tuổi Trẻ', 'https://tuoitre.vn/rss/tin-moi-nhat.rss'],
    ['Thanh Niên', 'https://thanhnien.vn/rss/home.rss'],
    ['VietnamNet', 'https://vietnamnet.vn/rss/tin-moi-nhat.rss'],
  ],
  world: [
    ['VnExpress Thế giới', 'https://vnexpress.net/rss/the-gioi.rss'],
    ['BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
  ],
  ai: [
    ['VnExpress Số hóa', 'https://vnexpress.net/rss/so-hoa.rss'],
    ['TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/feed/'],
    ['The Verge AI', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'],
  ],
  security: [
    ['The Hacker News', 'https://feeds.feedburner.com/TheHackersNews'],
    ['BleepingComputer', 'https://www.bleepingcomputer.com/feed/'],
    ['Krebs on Security', 'https://krebsonsecurity.com/feed/'],
  ],
};
const LIMIT = { vietnam: 60, world: 20, ai: 30, security: 25 };

const decode = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/\s+/g, ' ').trim();
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : ''; };

function parse(xml, source) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map(b => {
    let link = decode(tag(b, 'link'));
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ''; }
    const date = new Date(decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')));
    return {
      title: decode(tag(b, 'title')),
      link,
      summary: decode(tag(b, 'description') || tag(b, 'summary')).slice(0, 280),
      date: isNaN(date) ? null : date.toISOString(),
      source,
    };
  }).filter(i => i.title && /^https?:\/\//.test(i.link));
}

async function get(source, url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'TinTucSang/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(r.status);
    return parse(await r.text(), source);
  } catch (e) { console.warn('Lỗi', source, e.message); return []; }
}

const out = { updated: new Date().toISOString(), categories: {} };
for (const [cat, list] of Object.entries(FEEDS)) {
  const items = (await Promise.all(list.map(([s, u]) => get(s, u)))).flat();
  const seen = new Set();
  out.categories[cat] = items
    .filter(i => !seen.has(i.link) && seen.add(i.link))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, LIMIT[cat]);
}
await mkdir('public', { recursive: true });
await writeFile('public/news.json', JSON.stringify(out));
console.log('Đã cập nhật', Object.entries(out.categories).map(([k, v]) => `${k}:${v.length}`).join(' '));
