import { encodeMenuTitle, renderMenuTitle } from "./menu-title.js";
// Ported from elink2/mac-tool/webusb-demo.html. USB framing and ROM/menu encoding
// follow the existing prototype. The UI only consumes snapshots and write plans.
export const menuLength = 0x20000;
export const menuAddress = 0x20000;
export const windowSize = 0x08000000;
const blockSize = 4096;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const target = { vendorId: 0x3998, productId: 0x5893 };
const bootHash =
  "c45e9efceac765ae33a62c7b5532d09243326ed7eca1ea4fc4f55f1f434c33d8";

export async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function withTimeout(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function sendBulk(device, bytes) {
  const result = await withTimeout(device.transferOut(2, bytes), 3000);
  if (result.status !== "ok" || result.bytesWritten !== bytes.byteLength)
    throw new Error("transfer");
}

export function parseDirectory(menu) {
  const view = new DataView(menu.buffer, menu.byteOffset, menu.byteLength);
  if (menu.byteLength !== menuLength) throw new Error("directorySize");
  if (view.getUint32(0) === 0xffffffff) return [];
  const decoder = new TextDecoder("gb18030");
  const entries = [];
  for (let slot = 0; slot < 32; slot++) {
    const offset = 0x0e + slot * 0x198;
    const status = view.getUint16(offset, true);
    if (status === 0) continue;
    if (status !== 1) {
      throw new Error("directoryStatus");
    }
    const field = menu.subarray(offset + 0x1c, offset + 0x1c + 30);
    const end = field.indexOf(0);
    entries.push({
      slot,
      title: decoder.decode(end === -1 ? field : field.subarray(0, end)).trim(),
      address: view.getUint32(offset + 0x10, true),
      length: view.getUint32(offset + 0x14, true),
      saveAddress: view.getUint32(offset + 0x18, true),
    });
  }
  return entries;
}

async function claimCartridge(device) {
  const activeConfig = device.configuration?.configurationValue;
  if (activeConfig !== undefined && activeConfig !== 1) {
    throw new Error("configuration");
  }
  const config =
    device.configuration ??
    device.configurations.find(
      (candidate) => candidate.configurationValue === 1,
    );
  const iface = config?.interfaces.find(
    (candidate) => candidate.interfaceNumber === 0,
  );
  const alternate =
    activeConfig === 1
      ? iface?.alternate
      : iface?.alternates.find((candidate) => candidate.alternateSetting === 0);
  const endpoints = [
    { endpointNumber: 1, direction: "in", type: "interrupt", packetSize: 8 },
    { endpointNumber: 2, direction: "out", type: "bulk", packetSize: 64 },
    { endpointNumber: 2, direction: "in", type: "bulk", packetSize: 64 },
  ];
  if (
    alternate?.alternateSetting !== 0 ||
    alternate.interfaceClass !== 0xff ||
    !endpoints.every((expected) =>
      alternate.endpoints.some((endpoint) =>
        Object.entries(expected).every(
          ([key, value]) => endpoint[key] === value,
        ),
      ),
    )
  ) {
    throw new Error("descriptor");
  }
  if (activeConfig === undefined) {
    await device.selectConfiguration(1);
    if (device.configuration?.configurationValue !== 1) {
      throw new Error("configuration");
    }
  }
  await device.claimInterface(0);
}

export const romStart = 0x40000;
// Profile 4 reserves 32 × 64 KiB save slots below 0x08000000.
export const romEnd = 0x07e00000;
const maxRomLength = 32 * 1024 * 1024;

export function getRomSpace(menu) {
  const entries = parseDirectory(menu);
  if (menu.subarray(0, 4).every((byte) => byte === 0xff)) {
    throw new Error("uninitialized");
  }
  let end = romStart;
  for (const [slot, entry] of entries.entries()) {
    if (
      entry.slot !== slot ||
      entry.address < end ||
      entry.length === 0 ||
      entry.address % menuLength ||
      entry.length % menuLength ||
      entry.saveAddress !== 0x07ff0000 - slot * 0x10000 ||
      entry.address + entry.length > romEnd
    ) {
      throw new Error("layout");
    }
    end = entry.address + entry.length;
  }
  const address = Math.ceil(end / menuLength) * menuLength;
  return { slot: entries.length, address, available: romEnd - address };
}

export function createTruncatePlan(menu, slot) {
  const before = getRomSpace(menu);
  const entries = parseDirectory(menu);
  if (
    !Number.isInteger(slot) ||
    !entries.some((entry) => entry.slot === slot)
  ) {
    throw new Error("missingGame");
  }
  const candidate = menu.slice();
  const view = new DataView(candidate.buffer);
  for (let index = slot; index < 32; index++) {
    view.setUint16(0x0e + index * 0x198, 0, true);
  }
  const after = getRomSpace(candidate);
  return {
    kind: "truncate",
    menu,
    candidate,
    slot,
    removed: entries.slice(slot),
    freed: after.available - before.available,
    availableAfter: after.available,
  };
}

export function allocateRom(menu, size, replaceSlot) {
  const { slot, address, available } = getRomSpace(menu);
  if (!Number.isSafeInteger(size) || size < 192 || size > maxRomLength)
    throw new Error("romSize");
  const length = Math.ceil(size / menuLength) * menuLength;
  if (replaceSlot !== undefined) {
    const replaced = parseDirectory(menu)[replaceSlot];
    if (!replaced || replaced.address % menuLength !== 0) {
      throw new Error("alignment");
    }
    if (length > replaced.length) {
      throw new Error("replacementSpace");
    }
    return { slot: replaceSlot, address: replaced.address, length, replaced };
  }
  if (slot === 32) throw new Error("slotsFull");
  if (length > available) {
    throw new Error("space");
  }
  return { slot, address, length };
}

export function operationFrame(op, address, length) {
  const frame = new DataView(new ArrayBuffer(16));
  frame.setUint16(0, op, true);
  if (length) {
    frame.setUint32(4, address / 2, true);
    frame.setUint32(8, (address + length - 2) / 2, true);
  }
  return frame;
}

function watchWriteStatus(device) {
  const queue = [];
  let stopped = false;
  let failure;
  void (async () => {
    try {
      while (!stopped) {
        const result = await device.transferIn(1, 8);
        if (stopped) return;
        if (result.status !== "ok" || !result.data?.byteLength) {
          throw new Error("status");
        }
        if (queue.length >= 256) throw new Error("status");
        queue.push(result.data.getUint8(0));
      }
    } catch (error) {
      if (!stopped) failure = error;
    }
  })();
  return {
    stop() {
      stopped = true;
    },
    check() {
      if (failure) throw failure;
    },
    clear() {
      queue.length = 0;
    },
    async next(deadline) {
      while (performance.now() < deadline) {
        this.check();
        if (queue.length) return queue.shift();
        await pause(10);
      }
      throw new Error("timeout");
    },
  };
}

async function readRange(device, status, address, length, progress = () => {}) {
  status.check();
  await sendBulk(device, operationFrame(2, address, length));
  const data = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += blockSize) {
    status.check();
    const size = Math.min(blockSize, length - offset);
    const result = await withTimeout(device.transferIn(2, size), 6000);
    if (result.status !== "ok" || result.data?.byteLength !== size) {
      throw new Error("read");
    }
    data.set(
      new Uint8Array(result.data.buffer, result.data.byteOffset, size),
      offset,
    );
    progress(offset + size, length);
  }
  return data;
}

async function writeRange(device, status, address, bytes, progress) {
  await pause(500);
  status.check();
  status.clear();
  await sendBulk(device, operationFrame(1, address, bytes.length));
  for (let offset = 0; offset < bytes.length; offset += menuLength) {
    const ready = await status.next(performance.now() + 8000);
    if (ready < 1 || ready > 10) throw new Error("writeStatus");
    for (let chunk = offset; chunk < offset + menuLength; chunk += blockSize) {
      status.check();
      await sendBulk(device, bytes.subarray(chunk, chunk + blockSize));
    }
    progress(offset + menuLength, bytes.length);
  }
  const deadline = performance.now() + 5000;
  let value;
  do {
    value = await status.next(deadline);
    if (value !== 0x55 && (value < 1 || value > 10)) {
      throw new Error("writeStatus");
    }
  } while (value !== 0x55);
}

// Canonical GBA logo from the native writer's normalized header.
const gbaLogo = Uint8Array.from(
  "24ffae51699aa2213d84820a84e409ad11248b98c0817f21a352be199309ce2010464a4af82731ec58c7e83382e3cebf85f4df94ce4b09c194568ac01372a7fc9f844d73a3ca9a615897a327fc039876231dc7610304ae56bf38840040a70efdff52fe036f9530f197fbc08560d68025a963be03014e38e2f9a234ffbb3e0344780090cb88113a9465c07c6387f03cafd625e48b380aac7221d4f807".match(
    /../g,
  ),
  (hex) => parseInt(hex, 16),
);

function writeMenuTitle(candidate, slotOffset, title) {
  const encoded = encodeMenuTitle(title);
  const glyph = renderMenuTitle(title);
  const field = slotOffset + 0x1c;
  candidate.fill(0x20, field, field + 29);
  candidate.set(encoded, field);
  candidate[field + 29] = 0;
  candidate.fill(0xff, slotOffset + 0x3a, slotOffset + 0x198);
  candidate.set(glyph, slotOffset + 0x3a);
}

export async function prepareGamePlan(plan) {
  const menu = plan.menu;
  getRomSpace(menu);
  if (plan.kind === "truncate") {
    return { candidate: createTruncatePlan(menu, plan.slot).candidate };
  }

  const replaceSlot = plan.allocation.replaced?.slot;
  const { slot, address, length } = allocateRom(
    menu,
    plan.file.size,
    replaceSlot,
  );
  const payload = new Uint8Array(length).fill(0xff);
  payload.set(new Uint8Array(await plan.file.arrayBuffer()));
  payload.set(gbaLogo, 4);
  payload[0xb4] = 0x80;
  payload[0xbd] = -payload
    .subarray(0xa0, 0xbd)
    .reduce((sum, byte) => sum + byte, 0x19);
  payload.fill(0, 0xbe, 0xc0);
  const candidate = menu.slice();
  const slotOffset = 0x0e + slot * 0x198;
  const row = new DataView(candidate.buffer, slotOffset, 0x198);
  if (replaceSlot === undefined) {
    row.setUint16(0, 1, true);
    row.setUint16(2, 0x000a, true);
    row.setUint16(4, 29 * (slot % 5) + 0x16, true);
    row.setUint16(6, address >>> 14, true);
    row.setUint16(8, 0x1000, true);
    row.setUint32(0x10, address, true);
    row.setUint32(0x18, 0x07ff0000 - slot * 0x10000, true);
  }
  row.setUint32(0x14, length, true);
  writeMenuTitle(candidate, slotOffset, plan.title);
  return { candidate, payload };
}

export function selectDevice() {
  // Must run directly inside the click handler to preserve user activation.
  return navigator.usb.requestDevice({ filters: [target] });
}

const blockedDevices = new WeakSet();

async function session(device, task) {
  if (blockedDevices.has(device)) throw new Error("reconnectRequired");
  let status;
  try {
    await device.open();
    await claimCartridge(device);
    return await task(() => (status = watchWriteStatus(device)));
  } finally {
    status?.stop();
    if (device.opened) {
      try {
        await withTimeout(device.close(), 4000);
      } catch {
        // An unfinished transfer must never share a new session with another command.
        blockedDevices.add(device);
        throw new Error("reconnectRequired");
      }
    }
  }
}

export async function readCartridge(device, cold, progress) {
  return session(device, async (startStatus) => {
    let status;
    if (cold) {
      progress("initializing");
      const response = await fetch("/show3.bin");
      if (!response.ok) throw new Error("initializer");
      const show3 = new Uint8Array(await response.arrayBuffer());
      if (
        show3.length !== menuLength ||
        (await sha256(show3)) !==
          "9911c054083b600eff12b07ac6a8bf97931cbf032b5aa7bf59203263cab6e7c3"
      )
        throw new Error("initializer");
      const handshake = (async () => {
        while (true) {
          const packet = await device.transferIn(1, 8);
          if (packet.status !== "ok" || !packet.data?.byteLength)
            throw new Error("status");
          if (packet.data.getUint8(0) === 4) return;
        }
      })();
      void handshake.catch(() => {});
      await pause(100);
      await sendBulk(device, new Uint8Array(0));
      await withTimeout(handshake, 10000);
      status = startStatus();
      for (let offset = 0; offset < show3.length; offset += blockSize) {
        status.check();
        await sendBulk(device, show3.subarray(offset, offset + blockSize));
      }
      await sendBulk(device, new Uint8Array(0));
      await pause(1000);
    } else {
      status = startStatus();
    }
    progress("reading");
    const menu = await readRange(device, status, menuAddress, menuLength);
    const boot = await readRange(device, status, 0, 192);
    status.check();
    parseDirectory(menu);
    return { menu, recognized: (await sha256(boot)) === bootHash };
  });
}

async function verify(device, status, address, bytes, progress) {
  const actual = await readRange(
    device,
    status,
    address,
    bytes.length,
    progress,
  );
  if ((await sha256(actual)) !== (await sha256(bytes)))
    throw new Error("changed");
}

export async function applyPlan(
  device,
  plan,
  progress,
  { verifyAfterWrite = false } = {},
) {
  let writing = false;
  try {
    const { candidate, payload } = await prepareGamePlan(plan);
    await session(device, async (startStatus) => {
      const status = startStatus();
      progress("checking");
      await verify(device, status, menuAddress, plan.menu);
      const boot = await readRange(device, status, 0, 192);
      if ((await sha256(boot)) !== bootHash) throw new Error("identity");
      if (payload) {
        const { address, length } = plan.allocation;
        // Invalidate the session even if the command fails before its first payload.
        writing = true;
        await writeRange(device, status, address, payload, (done, total) =>
          progress("writingRom", done, total),
        );
        if (verifyAfterWrite) {
          progress("verifyingRom", 0, length);
          await verify(device, status, address, payload, (done, total) =>
            progress("verifyingRom", done, total),
          );
        }
      }
      progress("writingMenu");
      writing = true;
      await writeRange(device, status, menuAddress, candidate, (done, total) =>
        progress("writingMenu", done, total),
      );
      if (verifyAfterWrite) {
        progress("verifyingMenu");
        await verify(device, status, menuAddress, candidate);
        await verify(device, status, 0, boot);
      }
      await pause(500);
      status.check();
      await sendBulk(device, operationFrame(7, 0, 0));
      // No further reads after op7. Reboot and start a fresh connection.
    });
  } catch (error) {
    error.writingStarted = writing;
    throw error;
  }
}
