// Keep source strings intact; normalize only the searchable representation.
export function normalizeSearch(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase()
    .replace(/[ァ-ヶ]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

const aliases = {
  conversion: ["変換"], dictionary: ["辞書"], dictionaries: ["辞書"],
  flick: ["フリック"], keyboard: ["キーボード"], theme: ["テーマ"],
  appearance: ["テーマ", "表示"], prediction: ["予測"], clipboard: ["クリップボード"],
  handwriting: ["手書き"], translation: ["翻訳"], vibration: ["バイブレーション", "振動"],
  sound: ["音", "効果音"], emoji: ["絵文字"], symbols: ["記号"],
  backup: ["バックアップ"], layout: ["配列", "レイアウト"], kana: ["かな"],
  romaji: ["ローマ字"], language: ["言語"], size: ["サイズ", "大きさ"],
};

export function editionMatches(item, edition) {
  if (edition === "full-only") return item.edition === "Full only";
  if (edition === "full") return ["Full only", "Full and Lite"].includes(item.edition);
  if (edition === "lite") return ["Lite only", "Full and Lite"].includes(item.edition);
  return true;
}

export function createSearchIndex(items) {
  return items.map(item => ({ item, text: normalizeSearch([
    item.title, item.purpose, item.category, item.default, item.kind, item.key,
    item.edition, item.dependency, ...(item.values || []),
    ...(item.options || []).flatMap(option => [option.label, option.value]),
    ...Object.values(item.range || {}),
  ].filter(value => value !== null && value !== undefined).join(" ")) }));
}

export function searchSettings(index, { query = "", category = "", edition = "all" } = {}) {
  const terms = normalizeSearch(query).trim().split(/\s+/u).filter(Boolean);
  return index.filter(({ item, text }) =>
    (!category || item.category === category) && editionMatches(item, edition) &&
    terms.every(term => [term, ...(aliases[term] || []).map(normalizeSearch)]
      .some(word => text.includes(word)))
  ).map(({ item }) => item);
}
