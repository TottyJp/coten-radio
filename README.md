# COTEN RADIO エピソードガイド

SpotifyのCOTEN RADIOをシリーズ別・キーワード検索で探せる静的Webサイト。

**公開URL:** https://TottyJp.github.io/coten-radio/

---

## 使い方

### ローカルで確認する

```bash
npx serve . -p 4321
# → http://localhost:4321 をブラウザで開く
```

### エピソードデータを最新化する

新エピソードが追加されたときは以下を実行：

```bash
node scripts/import-rss.js
```

`data/episodes.json` がRSSフィード＋iTunes APIから自動更新される。

完了後、GitHub Desktopで **Push origin** するとサイトに反映される。

---

## ファイル構成

```
COTENRADIO/
├── index.html              # サイト本体（SPA）
├── css/style.css           # スタイル（モバイルファースト）
├── js/app.js               # ルーティング・検索ロジック
├── data/
│   └── episodes.json       # エピソードデータ（自動生成）
└── scripts/
    └── import-rss.js       # RSSインポートスクリプト
```

---

## インポートの仕組み

### RSSフィード（全エピソード取得）
- **取得元:** `https://anchor.fm/s/8c2088c/podcast/rss`（Spotify for Podcasters）
- RSS URLはiTunes APIで逆引きして発見：
  ```bash
  curl "https://itunes.apple.com/lookup?id=1450522865&entity=podcast" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['results'][0]['feedUrl'])"
  ```
- タイトルの `【N-M】` パターンでシリーズ番号・話数を判別
- `【番外編＃N】` パターンは番外編シリーズとして分類

### iTunes API（Apple Podcasts URLの取得）
- **認証不要・無料**
- 直近200話を一括取得、さらにシリーズ名で検索して古い話を補完
- Apple Podcasts URL（`podcasts.apple.com`）が取得できたエピソードはタップでPodcastsアプリが開く
- 取得できなかったエピソードは `hasLink: false` としてグレーアウト＋「リンクなし」バッジ表示

### 現在の対応状況
- 全727話中 約588話 → Podcastsアプリで開く
- 残り約25話 → リンクなし（古すぎてiTunes APIにデータなし）

---

## GitHub Pagesへのデプロイ（初回設定済み）

リポジトリ: https://github.com/TottyJp/coten-radio

データ更新後の反映手順：
1. `node scripts/import-rss.js` を実行
2. GitHub Desktopで **Push origin** をクリック
