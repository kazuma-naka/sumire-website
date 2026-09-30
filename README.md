# Sumire Website

Japanese and English public website for the Sumire Android keyboard. The static frontend and Cloudflare Pages Functions live in [`website/`](website/). The site includes an app overview, feature pages, a source-derived settings guide, and an account-free request form with private moderation.

## Local development

Requirements: Node.js 22 or newer and pnpm 11.25.0.

```powershell
cd website
pnpm install
Copy-Item .dev.vars.example .dev.vars
```

For local request form testing, fill `.dev.vars` with Cloudflare Turnstile's public test keys and a unique local admin token. Then run:

```powershell
pnpm db:migrate:local
pnpm dev
```

Open <http://127.0.0.1:8788/>. The local D1 database and `.dev.vars` are ignored by Git. Never put production secrets in the repository.

To create the static build without starting the local server:

```powershell
pnpm build
```

## Pages

- `/` and `/en/` — home pages in Japanese and English.
- `/features.html` and `/en/features.html` — available features and input modes.
- `/settings.html` and `/en/settings.html` — searchable Full / Lite settings guide. Setting names and source strings are retained as they appear in the Japanese Android source.
- `/requests.html` and `/en/requests.html` — dictionary word, bug, and feature submissions. New submissions remain private until approved.
- `/review.html` and `/en/review.html` — token-protected moderation screen; use HTTPS in deployed environments.

The header lets visitors choose a language and a light or dark theme. Theme choice is saved in the current browser; absent a saved choice, the site follows the operating system setting.

## Cloudflare Pages

The Pages build root is `website`, build command is `pnpm build`, and output directory is `dist`. The Pages Functions require a D1 binding named `DB`, a Turnstile widget and encrypted server secrets. Review the detailed setup, production/preview separation, moderation, and security notes in [`website/README.md`](website/README.md) before connecting a live environment.

No sample submissions are bundled or displayed as real reports. The public submissions list only contains items approved by a moderator.

## Japanese

Sumire Android キーボードの公式情報サイトです。日本語・英語のホーム、機能紹介、アプリのソースから確認した設定ガイド、アカウント登録なしで送れる投稿フォームを含みます。投稿は管理者の確認と承認が終わるまで公開されません。

ローカル起動、Cloudflare Pages の設定、D1 と Turnstile の構成、審査方法については [`website/README.md`](website/README.md) を参照してください。`.dev.vars` や本番用の認証情報を Git に追加しないでください。
