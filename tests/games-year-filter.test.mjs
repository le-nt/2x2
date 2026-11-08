import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(root, "site/games.html"), "utf8");
const maps = JSON.parse(fs.readFileSync(path.join(root, "site/data/maps.json"), "utf8")).maps;

test("games page contains parseable year + collection filter implementation", () => {
  const script = html.match(/<script>\s*(\(async function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)?.[1];
  assert.ok(script, "games page inline script exists");
  assert.doesNotThrow(() => new vm.Script(script, { filename: "games-page-inline.js" }));
  for (const key of ['id="YearList"', 'id="EditionList"', 'data-edition="standard"', 'data-edition="legacy"', 'data-edition="extras"', 'a.dataset.year']) {
    assert.ok(html.includes(key), key);
  }
});

test("year tab data includes every indexed Novetus map for 2015–2017", () => {
  const counts = new Map([[2015, 2], [2016, 7], [2017, 12]]);
  for (const [year, expected] of counts) {
    const entries = maps.filter((m) => m.year === year);
    assert.equal(entries.length, expected, "catalog entries for " + year);
    assert.ok(entries.every((m) => m.id && m.name && m.era), "identifiable entries for " + year);
  }
  assert.equal(maps.length, 348, "existing catalog retained");
});
