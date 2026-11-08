import {
  getRomSpace,
  parseDirectory,
  romStart,
  romEnd,
  windowSize,
} from "./cartridge.js";

// Only the tail following the allocation high-water mark is appendable.
// Gaps are deliberately kept distinct from free space.
export function storageMap(menu) {
  const entries = parseDirectory(menu);
  const space = getRomSpace(menu);
  const regions = [{ kind: "reserved", address: 0, length: romStart }];
  let cursor = romStart;
  for (const entry of entries) {
    if (entry.address > cursor)
      regions.push({
        kind: "gap",
        address: cursor,
        length: entry.address - cursor,
      });
    regions.push({ kind: "game", ...entry });
    cursor = entry.address + entry.length;
  }
  if (space.address > cursor)
    regions.push({
      kind: "gap",
      address: cursor,
      length: space.address - cursor,
    });
  if (space.available)
    regions.push({
      kind: "free",
      address: space.address,
      length: space.available,
    });
  regions.push({ kind: "saves", address: romEnd, length: windowSize - romEnd });
  return {
    entries,
    regions,
    space,
    used: entries.reduce((sum, entry) => sum + entry.length, 0),
  };
}
