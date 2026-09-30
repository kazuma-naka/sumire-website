import { createSearchIndex, searchSettings } from "./settings-search.js";

const japanese = document.documentElement.lang.startsWith("ja");
const t = (ja, en) => japanese ? ja : en;
const list = document.querySelector("#settings-list");
const search = document.querySelector("#settings-search");
const category = document.querySelector("#settings-category");
const edition = document.querySelector("#settings-edition");
const count = document.querySelector("#settings-count");
const title = document.querySelector("#results-title");
const error = document.querySelector("#settings-error");
const revision = document.querySelector("#source-revision");
const sourceLink = document.querySelector("#source-link");
let index = [];
let ready = false;
let loadAttempts = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function rangeText(range) {
  if (!range || (range.min == null && range.max == null)) return "";
  return `${range.min ?? "…"} – ${range.max ?? "…"}` +
    (range.step == null ? "" : t(`（刻み ${range.step}）`, ` (step ${range.step})`));
}

function settingCard(item) {
  const card = element("article", "setting-card", "");
  card.append(element("p", "setting-category", item.category), element("h3", "", item.title));
  if (item.purpose) card.append(element("p", "setting-purpose", item.purpose));
  const metadata = element("dl", "setting-meta", "");
  const add = (label, value) => {
    metadata.append(element("dt", "", label));
    const description = element("dd", "", "");
    description.append(value);
    metadata.append(description);
  };
  add(t("初期値", "Default"), String(item.default ?? t("確認できる初期値なし", "No source default")));
  const choices = item.options?.length ? item.options.map(option => option.label) : item.values;
  add(t("選択肢・範囲", "Choices / range"),
    [choices?.join(" / "), rangeText(item.range)].filter(Boolean).join(" · ") || t("固定の選択肢なし", "No fixed choices"));
  const labels = { "Full and Lite": "Full / Lite", "Full only": t("Full のみ", "Full only"), "Lite only": t("Lite のみ", "Lite only") };
  add(t("対象", "Edition"), element("span", `setting-badge${item.edition === "Full only" ? " full-only" : ""}`,
    labels[item.edition] || t("ソースから確認できず", "Not specified in source")));
  card.append(metadata);
  if (item.dependency) card.append(element("p", "setting-purpose", t("補足：", "Note: ") + item.dependency));
  card.append(element("code", "setting-key", item.key));
  return card;
}

function render() {
  if (!ready) return;
  const results = searchSettings(index, { query: search.value, category: category.value, edition: edition.value });
  const fragment = document.createDocumentFragment();
  if (results.length) results.forEach(item => fragment.append(settingCard(item)));
  else fragment.append(element("p", "empty-results", t(
    "条件に合う設定はありません。検索語や絞り込みを変更してください。",
    "No matching settings. Try another search or change the filters.")));
  list.replaceChildren(fragment);
  count.textContent = t(`${results.length} 件 / 全 ${index.length} 件`, `${results.length} of ${index.length} settings`);
  title.textContent = category.value || t("すべての設定", "All settings");
  if (search.value.trim()) title.textContent = t("検索結果", "Search results");
}

async function loadCatalog() {
  ready = false;
  error.hidden = true;
  list.setAttribute("aria-busy", "true");
  count.textContent = t("設定を読み込んでいます…", "Loading settings…");
  try {
    // A retry also bypasses intermediaries that may have cached an invalid response.
    const url = loadAttempts++ ? `/data/settings.json?retry=${Date.now()}` : "/data/settings.json";
    const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("settings_fetch_failed");
    const catalog = await response.json();
    if (!Array.isArray(catalog.items) || !catalog.items.length ||
        catalog.items.some(item => !item || typeof item.key !== "string" || typeof item.title !== "string")) {
      throw new Error("invalid_catalog");
    }
    index = createSearchIndex(catalog.items);
    const selectedCategory = category.value;
    category.replaceChildren(new Option(t("すべてのカテゴリ", "All categories"), ""));
    const categories = [...new Set(catalog.items.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
    categories.forEach(value => category.append(new Option(value, value)));
    if (categories.includes(selectedCategory)) category.value = selectedCategory;
    const source = catalog.source;
    if (source?.commit) {
      revision.textContent = t(`確認日 ${source.verifiedOn} · commit ${source.commit}`, `Verified ${source.verifiedOn} · commit ${source.commit}`);
      sourceLink.href = `https://github.com/KazumaProject/JapaneseKeyboard/tree/${encodeURIComponent(source.commit)}`;
    } else revision.textContent = t("ソース情報はありません。", "Source revision unavailable.");
    ready = true;
    render();
  } catch (cause) {
    console.warn("Settings catalog could not be loaded:", cause.message);
    list.replaceChildren();
    error.hidden = false;
    count.textContent = t("読み込みに失敗しました", "Could not load settings");
    revision.textContent = t("ソース情報を読み込めませんでした。", "Could not load source information.");
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

const requestedEdition = new URLSearchParams(location.search).get("edition");
if (["full", "lite", "full-only"].includes(requestedEdition)) edition.value = requestedEdition;
search.addEventListener("input", event => { if (!event.isComposing) render(); });
search.addEventListener("compositionend", render);
category.addEventListener("change", render);
edition.addEventListener("change", render);
document.querySelector("#settings-retry").addEventListener("click", loadCatalog);
loadCatalog();
