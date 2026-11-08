import menuFont from "./menu-font.json" with { type: "json" };
// Menu strings use the same legacy Chinese encoding as parseDirectory.
// Native menu records use set bits for ink, MSB-first, within a 12px row.
export const titleByteLimit = 29;
let gbk;
function characterMap() {
  if (gbk) return gbk;
  gbk = new Map();
  const decoder = new TextDecoder("gb18030", { fatal: true });
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    for (let trail = 0x40; trail <= 0xfe; trail++) {
      if (trail === 0x7f) continue;
      const bytes = Uint8Array.of(lead, trail);
      try {
        const character = decoder.decode(bytes);
        if ([...character].length === 1 && !gbk.has(character))
          gbk.set(character, bytes);
      } catch {
        /* Unassigned pair. */
      }
    }
  }
  return gbk;
}
export function encodeMenuTitle(value) {
  const title = value.trim();
  if (!title) throw new Error("titleEmpty");
  const bytes = [];
  for (const character of title) {
    const code = character.codePointAt(0);
    if (code >= 0x20 && code <= 0x7e) bytes.push(code);
    else {
      const pair = characterMap().get(character);
      if (!pair) throw new Error("titleCharacter");
      bytes.push(...pair);
    }
  }
  if (bytes.length > titleByteLimit) throw new Error("titleLength");
  return Uint8Array.from(bytes);
}
export function defaultMenuTitle(filename, fallback) {
  const name =
    filename
      .replace(/\.gba$/i, "")
      .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
      .replace(/\s+/g, " ")
      .trim() || fallback;
  let title = "";
  for (const character of name) {
    try {
      encodeMenuTitle(title + character);
      title += character;
    } catch (error) {
      if (error.message === "titleLength") break;
      return fallback;
    }
  }
  return title.trim() || fallback;
}
export function renderMenuTitle(value) {
  encodeMenuTitle(value);
  const characters = [...value.trim()].map((character) => {
    const glyph = menuFont[character];
    if (!glyph) throw new Error("titleCharacter");
    return glyph;
  });
  // Add one horizontal ink pixel and keep a blank column between characters.
  // Vertical dilation would close the counters in dense 12px Chinese glyphs.
  const advanceWidth = (glyph) => glyph[0] + (glyph[1] && glyph[2] ? 1 : 0);
  const width = characters.reduce((sum, glyph) => sum + advanceWidth(glyph), 0);
  if (width > 224) throw new Error("titleWidth");
  const ink = characters.filter((glyph) => glyph[1] && glyph[2]);
  const top = Math.max(...ink.map((glyph) => glyph[2] + glyph[4]));
  const bottom = Math.min(...ink.map((glyph) => glyph[4]));
  if (top - bottom > 12) throw new Error("titleHeight");
  const baseline = top + Math.floor((12 - (top - bottom)) / 2);
  const stride = Math.ceil(width / 8);
  const result = new Uint8Array(3 + stride * 12);
  result.set([width, 12, stride]);
  let cursor = 0;
  for (const [
    advance,
    glyphWidth,
    glyphHeight,
    left,
    below,
    hex,
  ] of characters) {
    const sourceStride = Math.ceil(glyphWidth / 8);
    const pixels = Uint8Array.from(hex.match(/../g) || [], (byte) =>
      parseInt(byte, 16),
    );
    const yOffset = baseline - glyphHeight - below;
    for (let y = 0; y < glyphHeight; y++) {
      for (let x = 0; x < glyphWidth; x++) {
        const dx = cursor + left + x;
        const dy = yOffset + y;
        if (
          dx >= 0 &&
          dx < width &&
          dy >= 0 &&
          dy < 12 &&
          pixels[y * sourceStride + (x >> 3)] & (0x80 >> (x % 8))
        ) {
          result[3 + dy * stride + (dx >> 3)] |= 0x80 >> (dx % 8);
          if (dx + 1 < width) {
            result[3 + dy * stride + ((dx + 1) >> 3)] |= 0x80 >> ((dx + 1) % 8);
          }
        }
      }
    }
    cursor += advance + (glyphWidth && glyphHeight ? 1 : 0);
  }
  return result;
}
export function drawMenuTitle(canvas, glyph) {
  const [width, height, stride] = glyph;
  canvas.width = 224;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(224, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (glyph[3 + y * stride + (x >> 3)] & (0x80 >> (x % 8))) {
        const offset = (y * 224 + x) * 4;
        image.data.set([0, 0, 0, 255], offset);
      }
    }
  }
  context.putImageData(image, 0, 0);
}
