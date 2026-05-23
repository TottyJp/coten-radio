# COTEN RADIO エピソードガイド

SpotifyのCOTEN RADIOをシリーズ別・キーワード検索で探せる静的Webサイト。

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

`data/episodes.json` がRSSフィードから自動更新される。

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

## RSSインポートの仕組み

- **取得元:** `https://anchor.fm/s/8c2088c/podcast/rss`（Spotify for Podcasters）
- iTunes APIでApple PodcastsのURLからRSS URLを逆引きして発見
  ```bash
  curl "https://itunes.apple.com/lookup?id=1450522865&entity=podcast" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['results'][0]['feedUrl'])"
  ```
- タイトルの `【N-M】` パターンでシリーズ番号・話数を判別
- `【番外編＃N】` パターンは別シリーズとして分類

---

## GitHub Pagesへのデプロイ

1. GitHubにリポジトリを作成
2. プッシュ
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/ユーザー名/リポジトリ名.git
   git push -u origin main
   ```
3. GitHubリポジトリの Settings → Pages → Source を `main` ブランチに設定
4. `https://ユーザー名.github.io/リポジトリ名/` で公開される

> データ更新後は `git add data/episodes.json && git commit -m "update episodes" && git push` でサイトに反映。
