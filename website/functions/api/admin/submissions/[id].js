import { cleanText, hasAdminToken, json, readJson, sameOrigin } from "../../../_lib/http.js";

const PUBLIC_STATUSES = new Set(["under_review", "planned", "in_progress", "completed", "not_planned"]);

export async function onRequestPatch({ request, env, params }) {
  if (!sameOrigin(request)) return json({ error: "この送信元からは実行できません。" }, 403);
  if (!await hasAdminToken(request, env)) return json({ error: "管理者認証に失敗しました。" }, 401);
  if (!env.DB) return json({ error: "投稿データベースを利用できません。" }, 503);

  let input;
  try {
    input = await readJson(request, 4_000);
  } catch {
    return json({ error: "審査内容を読み取れませんでした。" }, 400);
  }
  const id = cleanText(String(params.id || ""), 80);
  const decision = input?.decision;
  const now = new Date().toISOString();
  let result;

  if (decision === "reject") {
    result = await env.DB.prepare(
      `UPDATE submissions
          SET moderation_status = 'rejected', public_title = NULL,
              public_description = NULL, public_status = NULL, reviewed_at = ?
        WHERE id = ? AND moderation_status = 'pending'`,
    ).bind(now, id).run();
  } else if (decision === "approve") {
    const title = cleanText(input.publicTitle, 160);
    const description = cleanText(input.publicDescription, 1_000);
    const status = cleanText(input.publicStatus, 24);
    if (!title || !description || !PUBLIC_STATUSES.has(status)) {
      return json({ error: "公開タイトル、公開内容、公開ステータスを確認してください。" }, 422);
    }
    result = await env.DB.prepare(
      `UPDATE submissions
          SET moderation_status = 'approved', public_title = ?, public_description = ?,
              public_status = ?, reviewed_at = ?
        WHERE id = ? AND moderation_status = 'pending'`,
    ).bind(title, description, status, now, id).run();
  } else {
    return json({ error: "審査結果を選択してください。" }, 400);
  }

  if (result.meta?.changes !== 1) return json({ error: "審査待ちの投稿が見つかりません。再読み込みしてください。" }, 409);
  return json({ ok: true, message: decision === "approve" ? "投稿を公開しました。" : "投稿を非公開にしました。" });
}
