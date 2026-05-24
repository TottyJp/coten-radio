// Usage: node scripts/fill-missing-links.js
// Searches iTunes API for episodes with hasLink: false and fills in applePodcastUrl

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, '../data/episodes.json');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// タイトルから検索キーワードを抽出（【】内を除いた本文の最初の15文字）
function toSearchQuery(title) {
  const clean = title.replace(/【[^】]*】/g, '').trim();
  return `COTEN RADIO ${clean.slice(0, 20)}`;
}

// タイトルの類似度チェック（iTunesのtrackNameと元タイトルを比較）
function isTitleMatch(itunesTitle, episodeTitle) {
  const normalize = s => s.replace(/[【】！？!?　\s]/g, '').toLowerCase();
  const a = normalize(itunesTitle);
  const b = normalize(episodeTitle);
  // 完全一致 or 一方が他方を含む
  return a === b || a.includes(b) || b.includes(a);
}

async function searchItunes(query) {
  const q = encodeURIComponent(query);
  const url = `https://itunes.apple.com/search?term=${q}&entity=podcastEpisode&media=podcast&limit=10&country=jp`;
  try {
    const res = await fetch(url);
    const data = JSON.parse(res);
    return data.results || [];
  } catch (e) {
    return [];
  }
}

(async () => {
  const raw = fs.readFileSync(OUT_PATH, 'utf8');
  const data = JSON.parse(raw);

  // リンクなしエピソードを収集
  const missing = [];
  for (const series of data.series) {
    for (const ep of series.episodes) {
      if (!ep.hasLink) {
        missing.push({ series, ep });
      }
    }
  }

  console.log(`リンクなしエピソード: ${missing.length}件\n`);

  let filled = 0;
  for (let i = 0; i < missing.length; i++) {
    const { series, ep } = missing[i];
    const query = toSearchQuery(ep.title);
    process.stdout.write(`[${i + 1}/${missing.length}] 検索中: "${query.slice(0, 40)}..."\n`);

    const results = await searchItunes(query);
    const match = results.find(r => r.kind === 'podcast-episode' && isTitleMatch(r.trackName, ep.title));

    if (match) {
      ep.applePodcastUrl = match.trackViewUrl;
      ep.hasLink = true;
      filled++;
      console.log(`  ✅ 見つかった: ${match.trackName.slice(0, 50)}`);
    } else {
      console.log(`  ❌ 見つからず (${results.length}件ヒットも不一致)`);
      if (results.length > 0) {
        console.log(`     候補: ${results[0].trackName.slice(0, 50)}`);
      }
    }

    await sleep(400); // レート制限対策
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n完了: ${filled}/${missing.length}件 補完しました`);
})();
