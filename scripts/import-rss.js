// Usage: node scripts/import-rss.js
// Fetches COTEN RADIO RSS and writes data/episodes.json
// Uses iTunes API to get proper Apple Podcasts URLs (no credentials needed)

const https = require('https');
const fs = require('fs');
const path = require('path');

const RSS_URL = 'https://anchor.fm/s/8c2088c/podcast/rss';
const ITUNES_URL = 'https://itunes.apple.com/lookup?id=1450522865&entity=podcastEpisode&limit=200&country=jp';
const OUT_PATH = path.join(__dirname, '../data/episodes.json');

const SERIES_COLORS = [
  '#E8A87C', '#7C9EE8', '#87C87C', '#C87CAA', '#E8D87C',
  '#7CE8D8', '#E87C7C', '#A87CE8', '#7CE8A8', '#E8A87C',
  '#5B8DB8', '#B8845B', '#8DB85B', '#845BB8', '#B85B84',
  '#5BB88D', '#B8B85B', '#5B5BB8', '#B85B5B', '#5BB8B8',
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function parseXml(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`);
      const found = r.exec(block);
      return found ? (found[1] || found[2] || '').trim() : '';
    };
    const link = get('link') || (() => {
      const r = /<guid[^>]*>([\s\S]*?)<\/guid>/.exec(block);
      return r ? r[1].trim() : '';
    })();
    items.push({ title: get('title'), description: get('description'), link });
  }
  return items;
}

function extractSeriesInfo(title) {
  // 【N-M】 pattern
  const m = /【(\d+)-(\d+)】(.+)/.exec(title);
  if (m) return { seriesNum: parseInt(m[1]), episodeNum: parseInt(m[2]), rest: m[3] };
  // 番外編
  const b = /【番外編[＃#](\d+)】(.+)/.exec(title);
  if (b) return { seriesNum: null, episodeNum: parseInt(b[1]), rest: b[2], isBonusu: true };
  // 特別編など
  return { seriesNum: null, episodeNum: null, rest: title };
}

function extractSeriesName(firstEpisodeTitle) {
  // Try 【COTEN RADIO XXX編1】 pattern
  const m = /【COTEN RADIO(?:ショート)?\s+(.+?)編\d+】/.exec(firstEpisodeTitle);
  if (m) return m[1];
  // Fallback: use 【N-1】 following text before 【
  const n = /【\d+-1】([^【]+)/.exec(firstEpisodeTitle);
  if (n) return n[1].replace(/！.*|。.*/, '').trim().slice(0, 30);
  return firstEpisodeTitle.slice(0, 30);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchItunesUrls(seriesNames) {
  const map = {};

  // 直近200話を一括取得
  const json = await fetch(ITUNES_URL);
  const data = JSON.parse(json);
  for (const r of data.results) {
    if (r.kind === 'podcast-episode') map[r.trackName.trim()] = r.trackViewUrl;
  }
  console.log(`一括取得: ${Object.keys(map).length}件`);

  // シリーズ名で検索して古い話を補完
  for (let i = 0; i < seriesNames.length; i++) {
    const name = seriesNames[i];
    const q = encodeURIComponent(`COTEN RADIO ${name}`);
    const url = `https://itunes.apple.com/search?term=${q}&entity=podcastEpisode&media=podcast&limit=25&country=jp`;
    try {
      const res = await fetch(url);
      const d = JSON.parse(res);
      let added = 0;
      for (const r of (d.results || [])) {
        if (r.kind === 'podcast-episode' && !map[r.trackName.trim()]) {
          map[r.trackName.trim()] = r.trackViewUrl;
          added++;
        }
      }
      process.stdout.write(`\r検索中... ${i+1}/${seriesNames.length} (累計: ${Object.keys(map).length}件)`);
    } catch(e) { /* skip */ }
    await sleep(300); // レート制限対策
  }
  console.log(`\n合計取得: ${Object.keys(map).length}件`);
  return map;
}

(async () => {
  console.log('RSSを取得中...');
  const xml = await fetch(RSS_URL);
  const items = parseXml(xml);
  console.log(`取得エピソード数: ${items.length}`);

  // シリーズ名を先に抽出
  const seriesNamesForSearch = [];
  const nums = new Set();
  for (const item of items) {
    const m = /【(\d+)-1】/.exec(item.title);
    if (m && !nums.has(m[1])) { nums.add(m[1]); seriesNamesForSearch.push(extractSeriesName(item.title)); }
  }

  const itunesMap = await fetchItunesUrls(seriesNamesForSearch);

  const seriesMap = {};
  const bonusEpisodes = [];
  const otherEpisodes = [];

  for (const item of items) {
    const info = extractSeriesInfo(item.title);
    const desc = stripHtml(item.description).slice(0, 200);

    const appleUrl = itunesMap[item.title.trim()] || null;
    const epData = (title, num) => ({
      number: num,
      title: title.trim(),
      description: desc,
      applePodcastUrl: appleUrl,
      hasLink: !!appleUrl,
    });

    if (info.seriesNum !== null) {
      if (!seriesMap[info.seriesNum]) seriesMap[info.seriesNum] = [];
      seriesMap[info.seriesNum].push(epData(info.rest, info.episodeNum));
    } else if (info.isBonusu) {
      bonusEpisodes.push(epData(info.rest, info.episodeNum));
    } else {
      otherEpisodes.push(epData(item.title, otherEpisodes.length + 1));
    }
  }

  const seriesNums = Object.keys(seriesMap).map(Number).sort((a, b) => a - b);
  const series = seriesNums.map((num, i) => {
    const eps = seriesMap[num].sort((a, b) => a.number - b.number);
    // Get series name from first episode's original title
    const firstItem = items.find(it => /【(\d+)-1】/.exec(it.title)?.[1] === String(num));
    const name = firstItem ? extractSeriesName(firstItem.title) : `シリーズ${num}`;
    return {
      id: `series-${num}`,
      title: name,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      episodes: eps,
    };
  });

  // Add 番外編 as a separate series if any
  if (bonusEpisodes.length > 0) {
    series.push({
      id: 'bonus',
      title: '番外編',
      color: '#888888',
      episodes: bonusEpisodes.sort((a, b) => a.number - b.number),
    });
  }

  const output = { series };
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`書き込み完了: ${OUT_PATH}`);
  console.log(`シリーズ数: ${series.length}`);
  series.forEach(s => console.log(`  ${s.title}: ${s.episodes.length}話`));
})();
