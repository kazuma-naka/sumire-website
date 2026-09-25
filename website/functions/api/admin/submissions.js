import { hasAdminToken, json, sameOrigin } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  if (!await hasAdminToken(request, env)) return json({ error: "管理者認証に失敗しました。" }, 401);
  if (!env.DB) return json({ error: "投稿データベースを利用できません。" }, 503);
  const result = await env.DB.prepare(
    `SELECT id, kind, payload_json AS payload, contact_email AS contactEmail, created_at AS createdAt
       FROM submissions
      WHERE moderation_status = 'pending'
      ORDER BY created_at ASC
      LIMIT 100`,
  ).all();
  const submissions = (result.results || []).map((row) => ({
    id: row.id,
    kind: row.kind,
    payload: JSON.parse(row.payload),
    contactEmail: row.contactEmail,
    createdAt: row.createdAt,
  }));
  return json({ submissions });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "この送信元からは実行できません。" }, 403);
  if (!await hasAdminToken(request, env)) return json({ error: "管理者認証に失敗しました。" }, 401);
  return json({ error: "PATCH を使って投稿を審査してください。" }, 405, { Allow: "GET, PATCH" });
}
