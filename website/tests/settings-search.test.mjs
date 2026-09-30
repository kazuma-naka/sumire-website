import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSearchIndex, normalizeSearch, searchSettings } from "../js/settings-search.js";

const catalog = JSON.parse(await readFile(new URL("../data/settings.json", import.meta.url)));
const index = createSearchIndex(catalog.items);

test("empty search returns every source setting", () => {
  assert.equal(searchSettings(index).length, catalog.items.length);
  assert.equal(searchSettings(index, { query: "　 " }).length, catalog.items.length);
});

test("Japanese, English, case and width variants find useful results", () => {
  for (const query of ["変換", "dictionary", "conversion", "flick", "ＱＷＥＲＴＹ", "Gemma"]) {
    assert(searchSettings(index, { query }).length > 0, query);
  }
  assert.equal(normalizeSearch("ﾌﾘｯｸ ＡＩ"), normalizeSearch("ふりっく ai"));
  assert.deepEqual(searchSettings(index, { query: "フリック" }), searchSettings(index, { query: "ふりっく" }));
});

test("query, category, and edition are combined", () => {
  const results = searchSettings(index, { query: "変換", category: "AI変換", edition: "full-only" });
  assert(results.length > 0);
  assert(results.every(item => item.category === "AI変換" && item.edition === "Full only"));
  assert(searchSettings(index, { edition: "lite" }).every(item => item.edition === "Full and Lite"));
  assert.equal(searchSettings(index, { edition: "full" }).length, catalog.items.length);
});

test("search includes metadata and requires every word", () => {
  const fixtures = createSearchIndex([{ key: "example", title: "Example", category: "Test", edition: "Full only", default: false,
    options: [{ label: "Gentle", value: "custom-choice" }], range: { min: 0, max: 123, step: 5 }, dependency: "Enable parent" }]);
  for (const query of ["example gentle", "custom-choice", "123", "false", "parent"]) assert.equal(searchSettings(fixtures, { query }).length, 1);
  assert.equal(searchSettings(fixtures, { query: "example nonexistent" }).length, 0);
  assert.equal(searchSettings(index, { query: "<script>alert('none')</script>" }).length, 0);
});
