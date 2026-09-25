export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJson(request, maxBytes = 16_000) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > maxBytes) throw new Error("body_too_large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("body_too_large");
  return JSON.parse(text);
}

export function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

export function isEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function hasAdminToken(request, env) {
  const expected = env.ADMIN_API_TOKEN;
  const header = request.headers.get("Authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !supplied) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}
