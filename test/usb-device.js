// A sparse in-memory cart for protocol tests, with independent interrupt and bulk pipes.
export class UsbCart {
  constructor(menu, boot = new Uint8Array(192)) {
    this.blocks = new Map();
    this.set(0, boot);
    this.set(0x20000, menu);
    this.configuration = {
      configurationValue: 1,
      interfaces: [
        {
          interfaceNumber: 0,
          alternate: {
            alternateSetting: 0,
            interfaceClass: 0xff,
            endpoints: [
              {
                endpointNumber: 1,
                direction: "in",
                type: "interrupt",
                packetSize: 8,
              },
              {
                endpointNumber: 2,
                direction: "out",
                type: "bulk",
                packetSize: 64,
              },
              {
                endpointNumber: 2,
                direction: "in",
                type: "bulk",
                packetSize: 64,
              },
            ],
          },
        },
      ],
    };
    this.commands = [];
    this.frames = [];
    this.interrupts = [];
    this.waiter = null;
    this.opened = false;
    this.corruptWrites = false;
  }
  set(address, data) {
    for (let i = 0; i < data.length; i++) {
      const block = Math.floor((address + i) / 4096);
      if (!this.blocks.has(block))
        this.blocks.set(block, new Uint8Array(4096).fill(255));
      this.blocks.get(block)[(address + i) % 4096] = data[i];
    }
  }
  get(address, length) {
    return Uint8Array.from(
      { length },
      (_, i) =>
        this.blocks.get(Math.floor((address + i) / 4096))?.[
          (address + i) % 4096
        ] ?? 255,
    );
  }
  async open() {
    this.opened = true;
  }
  async claimInterface() {}
  async close() {
    this.opened = false;
    this.waiter?.reject(new Error("closed"));
    this.waiter = null;
  }
  emit(value) {
    const view = new DataView(new Uint8Array([value]).buffer);
    if (this.waiter) {
      this.waiter.resolve({ status: "ok", data: view });
      this.waiter = null;
    } else this.interrupts.push(value);
  }
  async transferIn(endpoint, length) {
    if (endpoint === 1) {
      if (this.interrupts.length)
        return {
          status: "ok",
          data: new DataView(new Uint8Array([this.interrupts.shift()]).buffer),
        };
      return new Promise((resolve, reject) => {
        this.waiter = { resolve, reject };
      });
    }
    if (this.failRead) throw new Error("read");
    const bytes = this.get(this.readAddress, length);
    this.readAddress += length;
    return { status: "ok", data: new DataView(bytes.buffer) };
  }
  async transferOut(endpoint, input) {
    const bytes =
      input instanceof DataView ? new Uint8Array(input.buffer) : input;
    if (this.remaining > 0) {
      this.set(this.writeAddress, bytes);
      if (this.corruptWrites)
        this.set(this.writeAddress, new Uint8Array([bytes[0] ^ 1]));
      this.writeAddress += bytes.length;
      this.remaining -= bytes.length;
      if (this.remaining === 0) this.emit(0x55);
      else if (this.remaining % 0x20000 === 0) this.emit(1);
    } else if (bytes.length === 0) {
      this.emit(4);
    } else if (bytes.length === 16) {
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      const op = view.getUint16(0, true);
      this.frames.push(Array.from(bytes));
      const address = view.getUint32(4, true) * (op === 6 ? 1 : 2);
      const length = op === 6 ? 0 : view.getUint32(8, true) * 2 + 2 - address;
      this.commands.push({ op, address, length });
      if (op === 2) this.readAddress = address;
      if (op === 1) {
        this.writeAddress = address;
        this.remaining = length;
        this.emit(1);
      }
    }
    return { status: "ok", bytesWritten: bytes.length };
  }
}

export function directory(
  entries = [{ address: 0x40000, length: 0x20000, title: "TEST GAME" }],
) {
  const menu = new Uint8Array(0x20000);
  const view = new DataView(menu.buffer);
  entries.forEach((entry, slot) => {
    const offset = 0x0e + slot * 0x198;
    view.setUint16(offset, 1, true);
    view.setUint32(offset + 0x10, entry.address, true);
    view.setUint32(offset + 0x14, entry.length, true);
    view.setUint32(offset + 0x18, 0x07ff0000 - slot * 0x10000, true);
    menu.set(new TextEncoder().encode(entry.title || "GAME"), offset + 0x1c);
  });
  return menu;
}
