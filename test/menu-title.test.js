import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeMenuTitle,
  defaultMenuTitle,
  renderMenuTitle,
} from "../src/menu-title.js";

test("menu names round-trip in the cart encoding within the 29-byte field", () => {
  const decoder = new TextDecoder("gb18030");
  for (const name of [
    "Advance Wars",
    "旋转库鲁库鲁",
    "马里奥与路易 RPG",
    "中".repeat(14) + "A",
    "W".repeat(29),
  ]) {
    const bytes = encodeMenuTitle(name);
    assert.ok(bytes.length <= 29);
    assert.equal(decoder.decode(bytes), name);
  }
  for (const name of ["A".repeat(30), "中".repeat(15)])
    assert.throws(() => encodeMenuTitle(name), /titleLength/);
  assert.throws(() => encodeMenuTitle(" "), /titleEmpty/);
  assert.throws(() => encodeMenuTitle("Game 🎮"), /titleCharacter/);
  assert.throws(() => encodeMenuTitle("Game\nName"), /titleCharacter/);
});
test("default names remove release tags and stop at encoded character boundaries", () => {
  assert.equal(
    defaultMenuTitle("Advance Wars (USA) (Rev 1).gba", "ADVANCEWARS"),
    "Advance Wars",
  );
  assert.equal(
    defaultMenuTitle("中文".repeat(20) + ".gba", "GBA GAME"),
    "中文".repeat(7),
  );
  assert.equal(defaultMenuTitle("🎮.gba", "GBA GAME"), "GBA GAME");
});

test("fixed pixel glyphs fill the native 12px cell without browser font rasterization", () => {
  for (const name of [
    "Advance Wars",
    "逆转裁判 2",
    "旋转库鲁库鲁",
    "马里奥与路易 RPG",
    "gyp",
  ]) {
    const glyph = renderMenuTitle(name);
    const [width, height, stride] = glyph;
    assert.equal(height, 12);
    assert.ok(width <= 224);
    assert.equal(glyph.length, 3 + stride * height);
    assert.ok(glyph.length <= 0x198 - 0x3a);
  }
  const chinese = renderMenuTitle("中");
  assert.equal(chinese[0], 13);
  const rows = Array.from({ length: 12 }, (_, y) =>
    chinese.slice(3 + y * 2, 5 + y * 2).some((byte) => byte !== 0),
  );
  assert.equal(rows.filter(Boolean).length, 11);
  const a = renderMenuTitle("A");
  // The 7×9 capital A is emboldened horizontally; empty scanlines stay empty.
  assert.deepEqual(
    [...a.slice(3)],
    [
      0, 0, 0x18, 0, 0x18, 0, 0x3c, 0, 0x3c, 0, 0x66, 0, 0x7e, 0, 0x66, 0, 0xc3,
      0, 0xc3, 0, 0, 0, 0, 0,
    ],
  );
  assert.throws(() => renderMenuTitle("W".repeat(29)), /titleWidth/);
});

test("emboldening keeps a clear column between Chinese glyphs and respects width limits", () => {
  const glyph = renderMenuTitle("滚滚欢乐棒");
  const [width, height, stride] = glyph;
  assert.equal(width, 65);
  for (let y = 0; y < height; y++) {
    for (let x = 12; x < width; x += 13) {
      assert.equal(glyph[3 + y * stride + (x >> 3)] & (0x80 >> (x % 8)), 0);
    }
  }
  assert.throws(() => renderMenuTitle("W".repeat(21)), /titleWidth/);
});
