import { json } from "../_lib/http.js";

export function onRequestGet({ env }) {
  return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || "" }, 200, {
    "Cache-Control": "public, max-age=300",
  });
}
