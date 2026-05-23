let allData = null;

async function loadData() {
  const res = await fetch('data/episodes.json');
  allData = await res.json();
}

function render() {
  const hash = location.hash;

  if (hash.startsWith('#series/')) {
    const id = hash.slice('#series/'.length);
    renderSeries(id);
  } else if (hash.startsWith('#search?q=')) {
    const q = decodeURIComponent(hash.slice('#search?q='.length));
    renderSearch(q);
  } else {
    renderHome();
  }
}

function renderHome() {
  const app = document.getElementById('app');
  const grid = allData.series.map(s => `
    <div class="series-card" style="--card-color: ${s.color}" data-id="${s.id}">
      <div class="series-card-title">${s.title}</div>
      <div class="series-card-count">${s.episodes.length}話</div>
    </div>
  `).join('');

  app.innerHTML = `
    <p class="section-title">シリーズ一覧</p>
    <div class="series-grid">${grid}</div>
  `;

  app.querySelectorAll('.series-card').forEach(card => {
    card.addEventListener('click', () => {
      location.hash = `#series/${card.dataset.id}`;
    });
  });
}

function renderSeries(id) {
  const series = allData.series.find(s => s.id === id);
  if (!series) { location.hash = ''; return; }

  const items = series.episodes.map(ep => episodeItemHTML(ep)).join('');

  const app = document.getElementById('app');
  app.innerHTML = `
    <button class="back-btn" id="back-btn">シリーズ一覧</button>
    <div class="series-header" style="border-left: 4px solid ${series.color}; padding-left: 12px;">
      <h2>${series.title}</h2>
      <p class="episode-count">${series.episodes.length}話</p>
    </div>
    <div class="episode-list">${items}</div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    location.hash = '';
  });
}

function renderSearch(query) {
  const q = query.trim().toLowerCase();
  const app = document.getElementById('app');

  if (!q) { renderHome(); return; }

  const results = [];
  allData.series.forEach(s => {
    s.episodes.forEach(ep => {
      const haystack = [ep.title, ep.description, ...(ep.keywords || [])].join(' ').toLowerCase();
      if (haystack.includes(q)) {
        results.push({ series: s, episode: ep });
      }
    });
  });

  if (results.length === 0) {
    app.innerHTML = `
      <button class="back-btn" id="back-btn">シリーズ一覧</button>
      <div class="search-results-header">
        <h2>「${escapeHtml(query)}」の検索結果</h2>
        <p class="result-count">見つかりませんでした</p>
      </div>
      <div class="empty-state">
        <p>別のキーワードで試してみてください</p>
      </div>
    `;
  } else {
    const items = results.map(({ series, episode }) =>
      episodeItemHTML(episode, series.title)
    ).join('');

    app.innerHTML = `
      <button class="back-btn" id="back-btn">シリーズ一覧</button>
      <div class="search-results-header">
        <h2>「${escapeHtml(query)}」の検索結果</h2>
        <p class="result-count">${results.length}件</p>
      </div>
      <div class="episode-list">${items}</div>
    `;
  }

  document.getElementById('back-btn').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    location.hash = '';
  });
}

function episodeItemHTML(ep, seriesTitle = null) {
  const tag = seriesTitle
    ? `<span class="episode-series-tag">${escapeHtml(seriesTitle)}</span>`
    : '';
  if (!ep.hasLink) {
    return `
      <div class="episode-item no-link">
        <span class="episode-number">#${ep.number}</span>
        <div class="episode-info">
          ${tag}
          <div class="episode-title">${escapeHtml(ep.title)}</div>
          <div class="episode-desc">${escapeHtml(ep.description)}</div>
        </div>
        <span class="no-link-badge">リンクなし</span>
      </div>
    `;
  }
  return `
    <a class="episode-item" href="${escapeHtml(ep.spotifyUrl)}" target="_blank" rel="noopener">
      <span class="episode-number">#${ep.number}</span>
      <div class="episode-info">
        ${tag}
        <div class="episode-title">${escapeHtml(ep.title)}</div>
        <div class="episode-desc">${escapeHtml(ep.description)}</div>
      </div>
      <span class="spotify-icon">▶</span>
    </a>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Search input handler
function setupSearch() {
  const input = document.getElementById('search-input');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q) {
      history.replaceState(null, '', `#search?q=${encodeURIComponent(q)}`);
      renderSearch(q);
    } else {
      history.replaceState(null, '', '#');
      renderHome();
    }
  });

  // Restore search input value when navigating back to search
  window.addEventListener('hashchange', () => {
    const hash = location.hash;
    if (hash.startsWith('#search?q=')) {
      input.value = decodeURIComponent(hash.slice('#search?q='.length));
    } else {
      input.value = '';
    }
    render();
  });

  // Logo click = go home
  document.getElementById('logo').addEventListener('click', () => {
    input.value = '';
    location.hash = '';
  });
}

(async () => {
  await loadData();
  setupSearch();
  render();
})();
