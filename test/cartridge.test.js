import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  allocateRom,
  createTruncatePlan,
  operationFrame,
  getRomSpace,
  prepareGamePlan,
  applyPlan,
  readCartridge,
  parseDirectory,
  windowSize,
} from "../src/cartridge.js";
import { storageMap } from "../src/storage.js";
import { UsbCart, directory } from "./usb-device.js";

const boot = new Uint8Array(
  await readFile(new URL("./fixtures/boot-prefix.bin", import.meta.url)),
);
function plan(menu) {
  const bytes = new Uint8Array(192);
  bytes[0xb2] = 0x96;
  const file = new File([bytes], "test.gba");
  return {
    menu,
    file,
    title: "NEW GAME",
    allocation: allocateRom(menu, file.size),
  };
}

test("op2 uses word addresses and inclusive final word", () => {
  const frame = operationFrame(2, 0x20000, 0x20000);
  assert.equal(frame.getUint32(4, true), 0x10000);
  assert.equal(frame.getUint32(8, true), 0x1ffff);
});
test("allocation validates bounds, slot continuity and save mapping", () => {
  const menu = directory();
  assert.equal(allocateRom(menu, 192).address, 0x60000);
  assert.equal(allocateRom(menu, 192).length, 0x20000);
  assert.throws(() => allocateRom(menu, 0), /romSize/);
  assert.throws(() => allocateRom(menu, 0x40000, 0), /replacementSpace/);
  const view = new DataView(menu.buffer);
  view.setUint32(0x0e + 0x18, 0, true);
  assert.throws(() => getRomSpace(menu), /layout/);
  const full = directory(
    Array.from({ length: 32 }, (_, slot) => ({
      address: 0x40000 + slot * 0x20000,
      length: 0x20000,
    })),
  );
  assert.throws(() => allocateRom(full, 192), /slotsFull/);
  const uninitialized = new Uint8Array(0x20000).fill(255);
  assert.deepEqual(parseDirectory(uninitialized), []);
  assert.throws(() => getRomSpace(uninitialized), /uninitialized/);
});
test("storage map partitions the window and never advertises interior gaps as appendable", () => {
  const menu = directory([
    { address: 0x40000, length: 0x20000 },
    { address: 0xa0000, length: 0x20000 },
  ]);
  const { regions } = storageMap(menu);
  assert.equal(
    regions.reduce((sum, region) => sum + region.length, 0),
    windowSize,
  );
  assert.equal(regions.find((region) => region.kind === "gap").length, 0x40000);
  assert.equal(
    regions.find((region) => region.kind === "free").address,
    0xc0000,
  );
  for (let i = 1; i < regions.length; i++)
    assert.equal(
      regions[i].address,
      regions[i - 1].address + regions[i - 1].length,
    );
});
test("read session closes USB and identifies the supported header", async () => {
  const device = new UsbCart(directory(), boot);
  const snapshot = await readCartridge(device, false, () => {});
  assert.equal(snapshot.recognized, true);
  assert.equal(parseDirectory(snapshot.menu).length, 1);
  assert.equal(device.opened, false);
});
test("direct write checks menu and identity, verifies ROM before menu and ends at op7", async () => {
  const menu = directory();
  const device = new UsbCart(menu, boot);
  const operation = plan(menu);
  const expected = await prepareGamePlan(operation);
  await applyPlan(device, operation, () => {}, { verifyAfterWrite: true });
  assert.deepEqual(
    device.get(operation.allocation.address, operation.allocation.length),
    expected.payload,
  );
  assert.deepEqual(device.get(0x20000, 0x20000), expected.candidate);
  const writes = device.commands.filter((command) => command.op === 1);
  assert.deepEqual(
    writes.map((command) => command.address),
    [operation.allocation.address, 0x20000],
  );
  const romWrite = device.commands.indexOf(writes[0]);
  const menuWrite = device.commands.indexOf(writes[1]);
  // Only the menu and 192-byte identity are read before the first write.
  assert.deepEqual(device.commands.slice(0, romWrite), [
    { op: 2, address: 0x20000, length: 0x20000 },
    { op: 2, address: 0, length: 192 },
  ]);
  assert.ok(
    device.commands
      .slice(romWrite + 1, menuWrite)
      .some(
        (command) =>
          command.op === 2 && command.address === operation.allocation.address,
      ),
  );
  assert.equal(device.commands.at(-1).op, 7);
  assert.equal(device.opened, false);
});
test("read-back is off by default and no reads follow the first write", async () => {
  const device = new UsbCart(directory(), boot);
  const stages = [];
  await applyPlan(device, plan(directory()), (stage) => stages.push(stage));
  const firstWrite = device.commands.findIndex((command) => command.op === 1);
  assert.equal(
    device.commands.slice(firstWrite).some((command) => command.op === 2),
    false,
  );
  assert.equal(stages.includes("verifyingRom"), false);
  assert.equal(stages.includes("verifyingMenu"), false);
  assert.deepEqual(
    device.commands
      .filter((command) => command.op === 1)
      .map((command) => command.address),
    [0x60000, 0x20000],
  );
  assert.equal(device.commands.at(-1).op, 7);
});
test("device write status is checked with read-back off", async () => {
  const device = new UsbCart(directory(), boot);
  const emit = device.emit.bind(device);
  device.emit = (value) => emit(value === 1 ? 0xee : value);
  await assert.rejects(
    applyPlan(device, plan(directory()), () => {}),
    (error) => error.message === "writeStatus" && error.writingStarted,
  );
  assert.equal(
    device.commands.some(
      (command) => command.op === 1 && command.address === 0x20000,
    ),
    false,
  );
  assert.equal(
    device.commands.some((command) => command.op === 7),
    false,
  );
  assert.equal(device.opened, false);
});
test("changed menu or identity prevents every write; corrupted ROM prevents menu commit", async () => {
  const menu = directory();
  const device = new UsbCart(menu, boot);
  const operation = plan(menu);
  device.set(0x20000, new Uint8Array([1]));
  await assert.rejects(
    applyPlan(device, operation, () => {}),
    (error) => error.message === "changed" && !error.writingStarted,
  );
  assert.equal(
    device.commands.some((command) => command.op === 1),
    false,
  );
  device.set(0x20000, menu);
  device.set(0, new Uint8Array([0]));
  await assert.rejects(
    applyPlan(device, operation, () => {}),
    (error) => error.message === "identity" && !error.writingStarted,
  );
  assert.equal(
    device.commands.some((command) => command.op === 1),
    false,
  );
  device.set(0, boot);
  device.corruptWrites = true;
  await assert.rejects(
    applyPlan(device, operation, () => {}, { verifyAfterWrite: true }),
    (error) => error.message === "changed" && error.writingStarted,
  );
  assert.equal(
    device.commands.some(
      (command) => command.op === 1 && command.address === 0x20000,
    ),
    false,
  );
  assert.equal(
    device.commands.some((command) => command.op === 7),
    false,
  );
  assert.equal(device.opened, false);
});

test("a failed USB close blocks reuse of the same device", async () => {
  const device = new UsbCart(directory(), boot);
  device.close = async () => {
    throw new Error("close failed");
  };
  await assert.rejects(
    readCartridge(device, false, () => {}),
    /reconnectRequired/,
  );
  const count = device.commands.length;
  await assert.rejects(
    readCartridge(device, false, () => {}),
    /reconnectRequired/,
  );
  assert.equal(device.commands.length, count);
  device.waiter?.reject(new Error("closed"));
});

test("delete-to-end removes the selected suffix and reclaims its entire tail", () => {
  const menu = directory([
    { address: 0x40000, length: 0x20000, title: "FIRST" },
    { address: 0x60000, length: 0x20000, title: "MIDDLE" },
    { address: 0xa0000, length: 0x20000, title: "LAST" },
  ]);
  menu[0x16000] = 0xa5;
  for (const [slot, freed] of [
    [0, 0x80000],
    [1, 0x60000],
    [2, 0x40000],
  ]) {
    const operation = createTruncatePlan(menu, slot);
    assert.equal(operation.removed.length, 3 - slot);
    assert.equal(operation.freed, freed);
    assert.equal(parseDirectory(operation.candidate).length, slot);
    const expected = menu.slice();
    const view = new DataView(expected.buffer);
    for (let index = slot; index < 32; index++)
      view.setUint16(0x0e + index * 0x198, 0, true);
    assert.deepEqual(operation.candidate, expected);
  }
  assert.equal(parseDirectory(menu).length, 3);
  const operation = createTruncatePlan(menu, 1);
  assert.equal(allocateRom(operation.candidate, 0x60000).address, 0x60000);
  assert.equal(operation.availableAfter, getRomSpace(menu).available + 0x60000);
  for (const slot of [-1, 3, 32, 1.5, "1", NaN]) {
    assert.throws(() => createTruncatePlan(menu, slot), /missingGame/);
  }
  assert.throws(() => createTruncatePlan(directory([]), 0), /missingGame/);
});
test("delete-to-end only writes the menu with either verification setting", async () => {
  for (const verifyAfterWrite of [false, true]) {
    const menu = directory([
      { address: 0x40000, length: 0x20000 },
      { address: 0x60000, length: 0x20000 },
      { address: 0x80000, length: 0x20000 },
    ]);
    const device = new UsbCart(menu, boot);
    const rom = new Uint8Array(0x60000).fill(0x33);
    const save = new Uint8Array(0x10000).fill(0x77);
    device.set(0x40000, rom);
    device.set(0x07ff0000, save);
    const operation = createTruncatePlan(menu, 1);
    const stages = [];
    await applyPlan(device, operation, (stage) => stages.push(stage), {
      verifyAfterWrite,
    });
    assert.deepEqual(
      device.commands.filter((command) => command.op === 1),
      [{ op: 1, address: 0x20000, length: 0x20000 }],
    );
    assert.deepEqual(device.get(0x20000, 0x20000), operation.candidate);
    assert.deepEqual(device.get(0x40000, rom.length), rom);
    assert.deepEqual(device.get(0x07ff0000, save.length), save);
    assert.equal(stages.includes("writingRom"), false);
    assert.equal(stages.includes("verifyingRom"), false);
    assert.equal(stages.includes("verifyingMenu"), verifyAfterWrite);
    const firstWrite = device.commands.findIndex((command) => command.op === 1);
    assert.equal(
      device.commands.slice(firstWrite).some((command) => command.op === 2),
      verifyAfterWrite,
    );
    assert.equal(device.commands.at(-1).op, 7);
    assert.equal(device.opened, false);
  }
});
test("delete-to-end rejects stale menus and stops on a failed menu verification", async () => {
  const menu = directory();
  const device = new UsbCart(menu, boot);
  const operation = createTruncatePlan(menu, 0);
  device.set(0x20000, new Uint8Array([1]));
  await assert.rejects(
    applyPlan(device, operation, () => {}),
    (error) => error.message === "changed" && !error.writingStarted,
  );
  assert.equal(
    device.commands.some((command) => command.op === 1),
    false,
  );
  device.set(0x20000, menu);
  device.corruptWrites = true;
  await assert.rejects(
    applyPlan(device, operation, () => {}, { verifyAfterWrite: true }),
    (error) => error.message === "changed" && error.writingStarted,
  );
  assert.equal(
    device.commands.some((command) => command.op === 7),
    false,
  );
  assert.equal(device.opened, false);
});

test("custom Chinese menu names preserve ROM identity and the following menu row", async () => {
  const operation = plan(directory());
  operation.title = "旋转库鲁库鲁";
  const { candidate, payload } = await prepareGamePlan(operation);
  const added = parseDirectory(candidate).at(-1);
  assert.equal(added.title, operation.title);
  const rowEnd = 0x0e + (added.slot + 1) * 0x198;
  assert.deepEqual(candidate.slice(rowEnd), operation.menu.slice(rowEnd));
  assert.deepEqual(payload.slice(0xa0, 0xac), new Uint8Array(12));
  operation.title = "中".repeat(15);
  await assert.rejects(prepareGamePlan(operation), /titleLength/);
});

test("menu bitmap uses set bits for ink and zero for background like native titles", async () => {
  const { candidate } = await prepareGamePlan(plan(directory()));
  const slot = parseDirectory(candidate).at(-1).slot;
  const offset = 0x0e + slot * 0x198 + 0x3a;
  const [width, height, stride] = candidate.slice(offset, offset + 3);
  const bitmap = candidate.slice(offset + 3, offset + 3 + stride * height);
  assert.equal(height, 12);
  assert.ok(width <= 224);
  // Native title fixtures have empty first/last scanlines, not solid white rectangles.
  assert.ok(bitmap.slice(0, stride).every((byte) => byte === 0));
  const setBits = [...bitmap].reduce(
    (sum, byte) => sum + byte.toString(2).replaceAll("0", "").length,
    0,
  );
  assert.ok(
    setBits < bitmap.length * 4,
    "background must not be filled with set bits",
  );
});
