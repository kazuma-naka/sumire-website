import { cleanText, isEmail, json, readJson, sameOrigin } from "../_lib/http.js";

const PUBLIC_STATUS_LABELS = {
  under_review: "検討中",
  planned: "対応予定",
  in_progress: "対応中",
  completed: "完了",
  not_planned: "見送り",
};

function normalizeSubmission(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "申請内容を読み取れませんでした。" };
  }
  const kind = input.kind;
  const source = input.payload;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { error: "入力欄を確認してください。" };
  }
  const payload = {};
  const issues = {};
  const required = (field, label, max) => {
    const value = cleanText(source[field], max);
    if (!value) issues[field] = `${label}を入力してください。`;
    payload[field] = value;
  };
  const optional = (field, max) => { payload[field] = cleanText(source[field], max); };

  if (kind === "dictionary") {
    required("term", "単語", 100);
    required("reading", "読み", 100);
    optional("partOfSpeech", 50);
    optional("context", 600);
  } else if (kind === "bug") {
    required("title", "不具合の概要", 120);
    const edition = cleanText(source.appEdition, 16);
    if (!["full", "lite", "unsure"].includes(edition)) issues.appEdition = "エディションを選択してください。";
    payload.appEdition = edition;
    optional("appVersion", 32);
    optional("androidVersion", 32);
    required("steps", "再現手順", 2_000);
    optional("expected", 800);
    optional("actual", 800);
  } else if (kind === "feature") {
    required("title", "提案のタイトル", 120);
    required("description", "提案の内容", 1_600);
    const edition = cleanText(source.targetEdition, 16);
    if (!["full", "lite", "either"].includes(edition)) issues.targetEdition = "対象エディションを選択してください。";
    payload.targetEdition = edition;
  } else {
    return { error: "投稿の種類が無効です。" };
  }

  const contactEmail = cleanText(input.contactEmail, 254);
  if (contactEmail && !isEmail(contactEmail)) issues.contactEmail = "メールアドレスの形式を確認してください。";
  if (Object.keys(issues).length) return { issues };
  return { kind, payload, contactEmail: contactEmail || null };
}

async function verifyTurnstile(request, token, env) {
  if (!env.TURNSTILE_SECRET || !env.TURNSTILE_SITE_KEY) return { ok: false, unavailable: true };
  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  let result;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { ok: false, unavailable: true };
    result = await response.json();
  } catch {
    return { ok: false, unavailable: true };
  }
  if (!result.success) return { ok: false };
  const requestHost = new URL(request.url).hostname.toLowerCase();
  const allowedHosts = (env.TURNSTILE_HOSTNAMES || requestHost)
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const localTestMode = env.TURNSTILE_TEST_MODE === "true" && env.CF_PAGES_BRANCH === "local";
  if (localTestMode) {
    if (result.hostname !== "example.com" || (result.action && result.action !== "test")) return { ok: false };
    return { ok: true };
  }
  if (result.action !== "request_submit") return { ok: false };
  if (typeof result.hostname !== "string" || result.hostname.toLowerCase() !== requestHost || !allowedHosts.includes(result.hostname.toLowerCase())) {
    return { ok: false };
  }
  return { ok: true };
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "投稿一覧を読み込めません。" }, 503);
  const query = await env.DB.prepare(
    `SELECT id, kind, public_title AS title, public_description AS description,
            public_status AS status, reviewed_at AS updatedAt
       FROM submissions
      WHERE moderation_status = 'approved'
        AND public_title IS NOT NULL
        AND public_description IS NOT NULL
        AND public_status IS NOT NULL
      ORDER BY reviewed_at DESC
      LIMIT 100`,
  ).all();
  const submissions = (query.results || []).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    status: row.status,
    statusLabel: PUBLIC_STATUS_LABELS[row.status] || "確認中",
    updatedAt: row.updatedAt,
  }));
  return json({ submissions }, 200, { "Cache-Control": "public, max-age=60" });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "この送信元からは投稿できません。" }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "JSON 形式の投稿だけ受け付けます。" }, 415);
  }
  if (!env.DB) return json({ error: "投稿を受け付けられません。" }, 503);

  let input;
  try {
    input = await readJson(request, 16_000);
  } catch (error) {
    const status = error.message === "body_too_large" ? 413 : 400;
    return json({ error: status === 413 ? "投稿が大きすぎます。" : "投稿内容を読み取れませんでした。" }, status);
  }

  const normalized = normalizeSubmission(input);
  if (normalized.error) return json({ error: normalized.error }, 400);
  if (normalized.issues) return json({ error: "入力内容を確認してください。", fields: normalized.issues }, 422);

  const token = cleanText(input.turnstileToken, 2_048);
  if (!token) return json({ error: "Turnstile の確認を完了してください。" }, 400);
  const verification = await verifyTurnstile(request, token, env);
  if (verification.unavailable) return json({ error: "投稿確認サービスに接続できません。時間をおいて再度お試しください。" }, 503);
  if (!verification.ok) return json({ error: "投稿確認に失敗しました。確認欄をやり直してください。" }, 400);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO submissions (id, kind, payload_json, contact_email, moderation_status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
    ).bind(id, normalized.kind, JSON.stringify(normalized.payload), normalized.contactEmail, createdAt).run();
  } catch {
    return json({ error: "投稿を保存できませんでした。時間をおいて再度お試しください。" }, 503);
  }
  return json({ ok: true, id, message: "投稿を受け付けました。公開前に内容を確認します。" }, 201);
}
