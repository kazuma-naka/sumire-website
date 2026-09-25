const list = document.querySelector("#settings-list");
const searchInput = document.querySelector("#settings-search");
const categorySelect = document.querySelector("#settings-category");
const editionSelect = document.querySelector("#settings-edition");
const count = document.querySelector("#settings-count");
const resultsTitle = document.querySelector("#results-title");
const errorBox = document.querySelector("#settings-error");
const revision = document.querySelector("#source-revision");
const sourceLink = document.querySelector("#source-link");
let catalog = null;

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function rangeText(item) {
  const { min, max, step } = item.range || {};
  if (min === null && max === null) return "";
  let label = `${min ?? "…"} 〜 ${max ?? "…"}`;
  if (step !== null && step !== undefined) label += `（刻み ${step}）`;
  return label;
}

function editionMatches(item, filter) {
  if (filter === "full-only") return item.edition === "Full only";
  if (filter === "full") return item.edition === "Full only" || item.edition === "Full and Lite";
  if (filter === "lite") return item.edition === "Full and Lite" || item.edition === "Lite only";
  return true;
}

function editionLabel(edition) {
  return ({ "Full and Lite": "Full / Lite", "Full only": "Full のみ", "Lite only": "Lite のみ" })[edition] || edition || "ソースから確認できず";
}

function settingCard(item) {
  const card = document.createElement("article");
  card.className = "setting-card";
  card.append(textElement("p", "setting-category", item.category));
  card.append(textElement("h3", "", item.title));
  if (item.purpose) card.append(textElement("p", "setting-purpose", item.purpose));

  const metadata = document.createElement("dl");
  metadata.className = "setting-meta";
  const addMeta = (label, value) => {
    metadata.append(textElement("dt", "", label));
    const definition = document.createElement("dd");
    if (label === "対象") {
      const badge = textElement("span", `setting-badge${item.edition === "Full only" ? " full-only" : ""}`, editionLabel(value));
      definition.append(badge);
    } else if (label === "選択肢・範囲") {
      definition.className = "setting-values";
      definition.textContent = value;
    } else {
      definition.textContent = value;
    }
    metadata.append(definition);
  };
  addMeta("初期値", item.default || "ソースから確認できる初期値なし");
  const choices = item.options?.length ? item.options.map((option) => option.label).join("、") : item.values?.join("、");
  addMeta("選択肢・範囲", [choices || "固定の選択肢なし", rangeText(item)].filter(Boolean).join(" ／ "));
  addMeta("対象", item.edition || "ソースから確認できず");
  card.append(metadata);
  if (item.dependency) card.append(textElement("p", "setting-purpose", `補足：${item.dependency}`));
  card.append(textElement("code", "setting-key", item.key));
  return card;
}

function render() {
  if (!catalog) return;
  const query = searchInput.value.trim().toLocaleLowerCase("ja");
  const category = categorySelect.value;
  const edition = editionSelect.value;
  const filtered = catalog.items.filter((item) => {
    if (category && item.category !== category) return false;
    if (!editionMatches(item, edition)) return false;
    const searchable = [item.title, item.purpose, item.category, item.default, item.kind, item.key,
      item.edition, item.dependency, ...(item.values || []), ...(item.options || []).map((option) => option.label), rangeText(item)]
      .filter(Boolean).join(" ").toLocaleLowerCase("ja");
    return !query || searchable.includes(query);
  });
  list.replaceChildren();
  if (filtered.length) {
    const fragment = document.createDocumentFragment();
    filtered.forEach((item) => fragment.append(settingCard(item)));
    list.append(fragment);
  } else {
    list.append(textElement("p", "empty-results", "条件に合う設定はありません。検索語や絞り込みを変更してください。"));
  }
  count.textContent = `${filtered.length} 件`;
  const categoryLabel = category || "すべてのカテゴリ";
  resultsTitle.textContent = category ? `${category} の設定` : "すべての設定";
  if (query) resultsTitle.textContent += `：「${searchInput.value.trim()}」`;
  if (edition !== "all") count.setAttribute("aria-label", `${categoryLabel}から ${filtered.length} 件を表示`);
  list.setAttribute("aria-busy", "false");
}

async function loadCatalog() {
  try {
    const response = await fetch("/data/settings.json", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("settings_fetch_failed");
    catalog = await response.json();
    const categories = [...new Set(catalog.items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
    for (const value of categories) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      categorySelect.append(option);
    }
    const params = new URLSearchParams(location.search);
    if (["full", "lite", "full-only"].includes(params.get("edition"))) editionSelect.value = params.get("edition");
    if (catalog.source) {
      const commit = catalog.source.commit;
      revision.textContent = `確認日 ${catalog.source.verifiedOn} ・ commit ${commit}`;
      sourceLink.href = `https://github.com/KazumaProject/JapaneseKeyboard/tree/${encodeURIComponent(commit)}`;
      sourceLink.setAttribute("aria-label", `確認した Android ソース ${commit} を GitHub で開く`);
    }
    render();
  } catch {
    errorBox.hidden = false;
    count.textContent = "読み込みに失敗しました";
    list.setAttribute("aria-busy", "false");
  }
}

searchInput.addEventListener("input", render);
categorySelect.addEventListener("change", render);
editionSelect.addEventListener("change", render);
loadCatalog();
