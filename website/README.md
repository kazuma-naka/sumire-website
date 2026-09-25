# Sumire public website

Japanese static website for the Sumire Android keyboard. Cloudflare Pages serves the static files and runs the request API as Pages Functions. D1 stores all requests as `pending`; only a moderator can publish a curated summary.

## Local preview

Prerequisites: Node.js 22 or newer and pnpm 11.25.0 (or use `npm`/`npx` equivalents). The Cloudflare Wrangler CLI is installed from this package.

```powershell
cd website
pnpm install
Copy-Item .dev.vars.example .dev.vars
```

For a working local request flow, edit the ignored `.dev.vars` file and use Cloudflare's public test credentials:

```dotenv
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
TURNSTILE_HOSTNAMES=localhost,127.0.0.1
TURNSTILE_TEST_MODE=true
ADMIN_API_TOKEN=<a unique random local-only token>
```

Generate a local token with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`; do not use the example placeholder as a secret. Test Turnstile keys always pass and are only for local development.

```powershell
pnpm db:migrate:local
pnpm dev
```

Open <http://127.0.0.1:8788/>. The local D1 database lives under Wrangler's ignored `.wrangler/` folder. Local submissions are only test data. To check the moderation screen, open `/review.html` and enter the local token. The token field is cleared after use and the token is held in page memory only.

Useful scripts:

- `pnpm build` — creates `dist/` from the site pages, assets, styles, scripts, settings catalog and response headers.
- `pnpm dev` — builds and starts the Pages local runtime (static files, Functions and local D1).
- `pnpm db:migrate:local` — applies the schema to the local D1 database.
- `pnpm db:migrate:remote` — applies the schema to the configured Cloudflare D1 database.

The reference mockup, source-import script, Functions and SQL migrations are not copied into the public static output.

## Cloudflare Pages setup

1. Create a Pages project named `sumire-website` and connect this repository. Set the project root to `website`, build command to `pnpm build`, and build output directory to `dist`. Use a current Node.js build environment and enable pnpm through Corepack if the build image does not supply it.
2. Create a D1 database named `sumire-requests`, then replace the placeholder `database_id` in `wrangler.jsonc` with the ID Cloudflare returns. Keep the `DB` binding name and migration directory. Add the D1 binding to both Production and Preview in Pages project settings if the dashboard manages environments separately.
3. Apply the schema using `pnpm db:migrate:remote` after the project is linked/authenticated. Review the selected database and environment before applying migrations.
4. Create a Turnstile widget that allows only the intended public hostnames (for example the production `pages.dev` hostname and your eventual website hostname). In Pages, set `TURNSTILE_SITE_KEY` to the widget's public site key and `TURNSTILE_HOSTNAMES` to the exact comma-separated hostnames returned by Siteverify. The site key is public and is returned by `/api/config`.
5. Add `TURNSTILE_SECRET` and `ADMIN_API_TOKEN` as encrypted Pages secrets for Production. Generate `ADMIN_API_TOKEN` from at least 32 random bytes, store it in a password manager, and never place it in source control or a `VITE_`/public build variable. For Preview, use a separate test Turnstile widget and secret, a separate random admin token, and a non-production D1 database. Do not reuse production credentials in preview.
6. Configure a custom domain only after reviewing the local preview and production deployment separately. Secrets, D1 bindings and Turnstile hostname settings must match that final hostname before accepting live submissions.

Cloudflare dashboard labels can change. The runtime names are `DB`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES`, and `ADMIN_API_TOKEN`; `TURNSTILE_TEST_MODE=true` is only for `.dev.vars` with Cloudflare's dummy keys. That exception also requires Wrangler's `CF_PAGES_BRANCH=local` and accepts only the test verifier's fixed `example.com` hostname. Deployed environments require the actual request hostname and the production widget's `request_submit` action. `TURNSTILE_SITE_KEY` is public; `DB` is a server binding. Keep `TURNSTILE_SECRET` and `ADMIN_API_TOKEN` encrypted. `.dev.vars` is ignored by Git and must not be committed.

## Review and publish submissions

Open `https://<site-host>/review.html` over HTTPS, enter the high-entropy `ADMIN_API_TOKEN`, and load the pending queue. For each request, review the original details and contact address (if provided), write a concise public title and description without personal information, choose a public status, and select **承認して公開**. The public board shows only these curated fields after the moderation state changes to `approved`. Select **却下して非公開** to reject a request. Rejected and pending records never appear on the public endpoint. The review token is not persisted in browser storage.

The Pages Function requires a same-origin request and a bearer token for every moderation operation; it compares token hashes in constant time. Keep the token private, rotate it by replacing the Pages secret if exposed, and do not send it through chat or a public issue. Consider using Cloudflare Access as an additional gate on `/review.html` and `/api/admin/*` if the review endpoint should be limited to a specific identity.

Submissions are validated again on the server, and Turnstile is verified with Cloudflare Siteverify before D1 writes. The API checks Siteverify success, the `request_submit` action and an explicit hostname allowlist. The browser never decides approval state. Keep the public status and copy free of reporter contact information.

## Updating the settings guide

`data/settings.json` was generated from the Android preference resources and `AppPreference.kt` at the source commit displayed on the page. When updating the Android source, regenerate it from a full checkout of that repository:

```powershell
python scripts/generate-settings.py <path-to-JapaneseKeyboard> --commit <source-commit-sha> --output data/settings.json
```

The generated file is checked in so the site remains static and does not need Android source at build time. Review changes to defaults/options before publishing an update.

## Security and data notes

- Public submissions are read from fields curated during approval. Raw form payloads and email addresses are returned only from the token-protected moderation endpoint.
- The browser validates fields for usability, while Pages Functions enforce type, required-field, length, email, origin, content-type, body-size, Turnstile, and D1 checks.
- Static responses set a restrictive Content Security Policy and browser security headers. Keep generated JavaScript free of inline scripts and render user text with text nodes.
- Configure the production and preview databases independently; do not run a remote migration against the wrong environment. Keep a backup/retention policy appropriate for the contact information submitted.
- This project does not publish the reference mockup's design example submissions.

Cloudflare references: [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/), [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Turnstile test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), and [D1 limits and pricing](https://developers.cloudflare.com/d1/platform/limits/).
