import {
  defaultMenuTitle,
  encodeMenuTitle,
  renderMenuTitle,
  drawMenuTitle,
} from "./menu-title.js";
import "./style.css";
import {
  selectDevice,
  readCartridge,
  parseDirectory,
  allocateRom,
  createTruncatePlan,
  getRomSpace,
  applyPlan,
  menuLength,
  menuAddress,
  sha256,
  windowSize,
} from "./cartridge.js";
import { storageMap } from "./storage.js";
import { getLocale, setLocale, t, errorText } from "./i18n.js";

const app = document.querySelector("#app");
const colors = [
  "#6650ce",
  "#239daf",
  "#4584d4",
  "#ae70d0",
  "#bf7e38",
  "#54956c",
  "#ba6192",
  "#628399",
];
const supported = Boolean(
  navigator.usb && globalThis.isSecureContext && crypto.subtle,
);
const state = {
  device: null,
  snapshot: null,
  recognized: false,
  busy: false,
  phase: "",
  progress: null,
  selected: null,
  modal: false,
  replaceSlot: undefined,
  plan: null,
  preview: null,
  verifyAfterWrite: false,
  error: null,
  result: null,
  resultKind: "rom",
  log: [],
  revision: 0,
};
let lastProgress = 0;
let modalOpener;

function escape(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
const label = (key) => escape(t(key));
function size(bytes) {
  return `${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 }).format((bytes * 8) / 1048576)} Mbit`;
}
function color(slot) {
  return colors[slot % colors.length];
}
function log(key, detail = "") {
  state.log.push({ time: new Date().toISOString(), stage: key, detail });
}
function progress(phase, done, total) {
  state.phase = phase;
  state.progress = total ? { done, total } : null;
  if (phase !== state.log.at(-1)?.stage) log(phase);
  if (!total || done === total || performance.now() - lastProgress > 150) {
    lastProgress = performance.now();
    render();
  }
}
function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function clearCart() {
  state.snapshot = null;
  state.recognized = false;
  state.device = null;
  state.plan = null;
  state.preview = null;
  state.selected = null;
}
function readOnlyReason() {
  if (!state.recognized) return new Error("identity");
  try {
    getRomSpace(state.snapshot);
  } catch (error) {
    return error;
  }
}

function render() {
  document.documentElement.lang = getLocale() === "zh" ? "zh-CN" : "en";
  app.innerHTML = `
    <header class="header"><div class="brand"><img src="/cart.svg" width="37" height="37" alt=""><span>elink2-web</span></div>
      <div class="header-actions"><span class="connection ${state.snapshot ? "online" : ""}"><i></i>${label(state.snapshot ? "connected" : "disconnected")}</span>
      <select id="language" aria-label="${label("language")}"><option value="zh" ${getLocale() === "zh" ? "selected" : ""}>中文</option><option value="en" ${getLocale() === "en" ? "selected" : ""}>English</option></select>
      ${state.snapshot ? `<button class="quiet" id="disconnect" ${state.busy ? "disabled" : ""}>${label("disconnect")}</button>` : ""}
      <a class="github-link" href="https://github.com/knktc/elink2-web" target="_blank" rel="noopener noreferrer" aria-label="${label("githubLink")}" title="${label("githubLink")}"><img src="/github.svg" width="20" height="20" alt=""><span>GitHub</span></a></div></header>
    <main>${state.snapshot ? dashboard() : connection()}
      ${state.result ? resultBanner() : ""}
      ${state.error && !state.modal ? errorBanner() : ""}
      <details class="diagnostics"><summary>${label("diagnostics")}</summary><div class="diagnostic-actions">
        ${state.snapshot ? `<button id="menu-backup" class="secondary">${label("menuBackup")}</button>` : ""}
        <button class="secondary" id="logs">${label("logs")}</button></div><p class="muted small">${label("local")}</p></details>
    </main><footer>${label("source")}</footer><dialog id="operation-dialog" aria-labelledby="dialog-title"></dialog>`;
  document.querySelector("#language").onchange = (event) => {
    setLocale(event.target.value);
    render();
  };
  document.querySelectorAll("[data-connect]").forEach((button) => {
    button.onclick = () => connect(button.dataset.connect === "cold");
  });
  document.querySelector("#disconnect")?.addEventListener("click", () => {
    clearCart();
    state.error = null;
    state.result = null;
    render();
  });
  document
    .querySelector("#refresh")
    ?.addEventListener("click", () => connect(false, true));
  document
    .querySelector("#add")
    ?.addEventListener("click", (event) =>
      openOperation(undefined, event.currentTarget),
    );
  document.querySelectorAll("[data-replace]").forEach((button) => {
    button.onclick = (event) =>
      openOperation(Number(button.dataset.replace), event.currentTarget);
  });
  document.querySelectorAll("[data-truncate]").forEach((button) => {
    button.onclick = (event) =>
      openOperation(Number(button.dataset.truncate), event.currentTarget, true);
  });
  document.querySelectorAll("[data-slot]").forEach((button) => {
    button.onclick = () => {
      state.selected = Number(button.dataset.slot);
      document
        .querySelectorAll("[data-slot], tr[data-row]")
        .forEach((element) => {
          element.classList.toggle(
            "selected",
            Number(element.dataset.slot ?? element.dataset.row) ===
              state.selected,
          );
          if (element.hasAttribute("data-slot"))
            element.setAttribute(
              "aria-pressed",
              String(element.classList.contains("selected")),
            );
        });
    };
  });
  document.querySelector("#logs").onclick = () =>
    saveFile(
      new Blob([JSON.stringify(state.log, null, 2)], {
        type: "application/json",
      }),
      "elink2-log.json",
    );
  document
    .querySelector("#menu-backup")
    ?.addEventListener("click", () =>
      saveFile(new Blob([state.snapshot]), "elink2-menu.bin"),
    );
  document.querySelector("#retry")?.addEventListener("click", () => {
    state.error = null;
    state.result = null;
    render();
  });
  if (state.modal) renderDialog();
}

function connection() {
  const picker = state.busy && state.phase === "picker";
  return `<section class="connect-area"><p class="eyebrow">${label("tagline")}</p>
    <ol class="steps"><li class="${picker ? "completed" : "active"}"><span>1</span>${label("stepHardware")}</li><li class="${picker ? "active" : ""}"><span>2</span>${label("stepPicker")}</li><li class="${state.busy && !picker ? "active" : ""}"><span>3</span>${label("stepReady")}</li></ol>
    <section class="connect-card">
      ${
        picker
          ? `<div class="picker-demo" aria-hidden="true"><div class="picker-caption">${label("pickerIllustration")}</div><div class="picker-row"><span>◉</span> ${label("pickerDevice")}</div><div class="picker-help"><span>${label("pickerSelect")}</span><span>${label("pickerConfirm")}</span></div></div>`
          : `<figure class="connection-figure"><img src="/connection.svg" width="660" height="240" alt="${escape(t("connectBody"))}"></figure>`
      }
      <h1>${label(picker ? "pickerTitle" : "connectTitle")}</h1>
      <p class="connect-copy">${label(picker ? "pickerBody" : "connectBody")}</p>
      ${
        state.busy
          ? `<div class="live-status" role="status"><span class="spinner"></span>${label(state.phase)}</div>${picker ? `<p class="picker-note">${label("pickerNote")}</p>` : ""}`
          : `<button class="primary connect-button" data-connect="cold" ${!supported ? "disabled" : ""}><svg class="usb-icon" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <circle cx="10" cy="7" r="1" /> <circle cx="4" cy="20" r="1" /> <path d="M4.7 19.3 19 5" /> <path d="m21 3-3 1 2 2Z" /> <path d="M9.26 7.68 5 12l2 5" /> <path d="m10 14 5 2 3.5-3.5" /> <path d="m18 12 1-1 1 1-1 1Z" /> </svg>${label("connect")}</button>
          <p class="direct">${label("directHint")} <button class="text-button" data-connect="direct" ${!supported ? "disabled" : ""}>${label("direct")}</button></p>
          <p class="picker-note">${label("pickerBody")}</p>`
      }
      ${!supported ? `<p class="notice">${label("unsupported")}</p>` : ""}
    </section></section>`;
}

function dashboard() {
  let map;
  try {
    map = storageMap(state.snapshot);
  } catch {
    /* A readable unknown directory can still be listed. */
  }
  const entries = parseDirectory(state.snapshot);
  const reason = readOnlyReason();
  return `<section class="dashboard"><div class="section-heading"><div><p class="eyebrow">elink2-web</p><h1>${label("overview")}</h1></div>
    <button id="refresh" class="secondary" ${state.busy ? "disabled" : ""}>↻ ${label("refresh")}</button></div>
    ${
      map
        ? `<div class="stats"><article><span>${label("addressWindow")}</span><strong>${size(windowSize)}</strong></article><article><span>${label("used")}</span><strong>${size(map.used)}</strong></article><article><span>${label("available")}</span><strong>${size(map.space.available)}</strong></article></div>
      <section class="storage-card"><div class="storage-map" role="group" aria-label="${label("mapLabel")}">${map.regions
        .map((region) => {
          const game = region.kind === "game";
          const text = game
            ? `${String(region.slot + 1).padStart(2, "0")} · ${region.title || t("untitled")}`
            : t(region.kind);
          const style = `width:${(region.length / windowSize) * 100}%;${game ? `--game-color:${color(region.slot)};background:${color(region.slot)}` : ""}`;
          return `<${game ? "button" : "div"} class="segment ${region.kind} ${game && state.selected === region.slot ? "selected" : ""}" style="${style}" title="${escape(`${text} · ${size(region.length)}`)}" ${game ? `data-slot="${region.slot}" aria-label="${escape(`${text}, ${size(region.length)}`)}" aria-pressed="${state.selected === region.slot}"` : `role="img" aria-label="${escape(`${text}, ${size(region.length)}`)}"`}>${region.kind === "reserved" || region.kind === "saves" ? "" : `<span>${escape(text)}</span>`}${region.length > windowSize / 12 ? `<small>${size(region.length)}</small>` : ""}</${game ? "button" : "div"}>`;
        })
        .join("")}</div><div class="map-labels">${map.regions
        .filter(
          (region) => region.kind === "reserved" || region.kind === "saves",
        )
        .map(
          (region) =>
            `<div class="edge-label ${region.kind === "saves" ? "end" : "start"}" style="left:${((region.address + region.length / 2) / windowSize) * 100}%"><span>${label(region.kind)}</span><span class="muted">${size(region.length)}</span></div>`,
        )
        .join(
          "",
        )}</div><div class="ruler"><span>0</span><span>256</span><span>512</span><span>768</span><span>1024 Mbit</span></div>
      <div class="legend"><span><i class="reserved"></i>${label("reserved")}</span><span><i class="game-key"></i>${label("games")}</span><span><i class="gap"></i>${label("gap")}</span><span><i class="free"></i>${label("free")}</span><span><i class="saves"></i>${label("saves")}</span></div>
      </section>`
        : ""
    }
    ${reason ? `<p class="notice">${label("readonly")} ${escape(errorText(reason))}</p>` : ""}
    <div class="section-heading list-heading"><div><h2>${label("games")}</h2><p class="muted small">${escape(t("gameCount", { count: entries.length }))}</p></div>
      <button class="primary" id="add" ${reason || state.busy || map?.space.slot === 32 || !map?.space.available ? "disabled" : ""}>＋ ${label("add")}</button></div>
    <div class="table-wrap"><table><thead><tr><th>${label("slot")}</th><th>${label("game")}</th><th>${label("size")}</th><th>${label("actions")}</th></tr></thead><tbody>
      ${entries.map((entry) => `<tr data-row="${entry.slot}" class="${state.selected === entry.slot ? "selected" : ""}" style="--game-color:${color(entry.slot)}"><td><span class="game-dot" style="background:${color(entry.slot)}"></span>${String(entry.slot + 1).padStart(2, "0")}</td><td><button class="game-name" data-slot="${entry.slot}" aria-pressed="${state.selected === entry.slot}">${escape(entry.title || t("untitled"))}</button></td><td>${size(entry.length)}</td><td><div class="game-actions"><button class="secondary compact" data-replace="${entry.slot}" ${reason || state.busy ? "disabled" : ""}>${label("replace")}</button><button class="secondary compact danger-text" data-truncate="${entry.slot}" ${reason || state.busy ? "disabled" : ""}>${label("deleteToEnd")}</button></div></td></tr>`).join("")}
    </tbody></table>${entries.length ? "" : `<p class="empty">${label("empty")}</p>`}</div></section>`;
}

function errorBanner() {
  return `<section class="notice error" role="alert"><strong>${label("errorTitle")}</strong><p>${escape(errorText(state.error))}</p><details><summary>${label("errorDetail")}</summary><code>${escape(state.error.message)}</code></details></section>`;
}
function resultBanner() {
  const failed = state.result === "recovery";
  const titles = {
    rom: { success: "writeFinishTitle", verified: "finishTitle" },
    truncate: { success: "deleteFinishTitle", verified: "deleteVerifiedTitle" },
  }[state.resultKind];
  const titleKey = failed ? "recoveryTitle" : titles[state.result];
  const bodyKey = {
    rom: "finishBody",
    truncate: "deleteFinishBody",
  }[state.resultKind];
  return `<section class="notice ${failed ? "error" : "success"}" role="status"><h2>${label(titleKey)}</h2><p>${label(failed ? "recoveryBody" : bodyKey)}</p><button class="secondary" id="retry">${label("retry")}</button></section>`;
}

async function connect(cold, reuse = false) {
  if (state.busy || !supported) return;
  const existing = reuse ? state.device : null;
  state.busy = true;
  state.error = null;
  state.result = null;
  state.phase = existing ? "reading" : "picker";
  clearCart();
  // Request the native picker before yielding, while the click still has activation.
  let selection;
  try {
    selection = existing ? Promise.resolve(existing) : selectDevice();
  } catch (error) {
    selection = Promise.reject(error);
  }
  render();
  try {
    const device = await selection;
    state.device = device;
    const snapshot = await readCartridge(device, cold, progress);
    state.snapshot = snapshot.menu;
    state.recognized = snapshot.recognized;
    log("read", await sha256(snapshot.menu));
  } catch (error) {
    clearCart();
    state.error = error;
    log("error", error.message);
  } finally {
    state.busy = false;
    render();
  }
}

function openOperation(slot, opener, truncate = false) {
  if (state.busy || readOnlyReason()) return;
  modalOpener = truncate ? `truncate-${slot}` : opener.id || `replace-${slot}`;
  state.modal = true;
  state.replaceSlot = slot;
  state.verifyAfterWrite = false;
  state.plan = truncate
    ? createTruncatePlan(state.snapshot.slice(), slot)
    : null;
  state.preview = null;
  state.error = null;
  render();
}
function closeOperation() {
  if (state.busy) return;
  state.modal = false;
  state.plan = null;
  state.preview = null;
  state.error = null;
  state.revision++;
  render();
  const element =
    modalOpener === "add"
      ? document.querySelector("#add")
      : document.querySelector(
          `[data-${modalOpener.startsWith("truncate-") ? "truncate" : "replace"}="${state.replaceSlot}"]`,
        );
  element?.focus();
}
function operationDetails(entry) {
  const preview = state.preview;
  if (!entry && !preview) return "";
  let reason = "";
  if (preview?.error) {
    reason =
      preview.error.message === "replacementSpace" && entry
        ? t("replacementTooLarge", {
            available: size(entry.length),
            required: size(preview.length),
            excess: size(preview.length - entry.length),
          })
        : errorText(preview.error);
  }
  return `<section class="preview">
    <h3>${label(entry ? "replacementDetails" : "preview")}</h3>
    <dl>
      ${entry ? `<dt>${label("original")}</dt><dd>${escape(entry.title || t("untitled"))}</dd><dt>${label("originalSpace")}</dt><dd>${size(entry.length)}</dd>` : ""}
      ${preview ? `<dt>${label("newTitle")}</dt><dd data-new-title>${escape(preview.title)}</dd><dt>${label("requiredSpace")}</dt><dd>${size(preview.length)}</dd>` : ""}
    </dl>
    ${reason ? `<div class="replacement-result error" role="alert"><strong>${label(entry ? "cannotReplace" : "cannotWrite")}</strong><p>${escape(reason)}</p></div>` : ""}
    ${entry && state.plan ? `<div class="replacement-result success" role="status">${label("canReplace")}</div>` : ""}
  </section>`;
}

function truncateDetails(plan) {
  return `<section class="preview">
    <p>${escape(
      t("deleteSummary", {
        count: plan.removed.length,
        title: plan.removed[0].title || t("untitled"),
      }),
    )}</p>
    <ul class="delete-games">${plan.removed.map((entry) => `<li><span>${String(entry.slot + 1).padStart(2, "0")} · ${escape(entry.title || t("untitled"))}</span><span class="muted">${size(entry.length)}</span></li>`).join("")}</ul>
    <dl><dt>${label("freedSpace")}</dt><dd>${size(plan.freed)}</dd>
      <dt>${label("availableAfterDelete")}</dt><dd>${size(plan.availableAfter)}</dd></dl>
  </section>`;
}

function renderDialog() {
  const dialog = document.querySelector("#operation-dialog");
  const entry = parseDirectory(state.snapshot).find(
    (item) => item.slot === state.replaceSlot,
  );
  const truncating = state.plan?.kind === "truncate";
  const title = truncating
    ? t("deleteToEnd")
    : entry
      ? t("replaceTitle", { title: entry.title || t("untitled") })
      : t("addTitle");
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${escape(title)}</h2><button class="icon-button" id="close-modal" aria-label="${label("close")}" ${state.busy ? "disabled" : ""}>×</button></div>
    ${
      state.busy
        ? `<div class="operation-progress" role="status"><span class="spinner"></span><h3>${label(state.phase)}</h3>${state.progress ? `<progress max="${state.progress.total}" value="${state.progress.done}"></progress><p class="mono small">${size(state.progress.done)} / ${size(state.progress.total)}</p>` : ""}<p class="muted">${label("busyNote")}</p></div>`
        : `${truncating ? truncateDetails(state.plan) : `<label class="file-label" for="rom-file">${label("file")}</label><input type="file" id="rom-file" accept=".gba"><p class="small muted">${escape(state.preview?.file.name || t("noFile"))}</p>${state.preview && !state.preview.error ? `<section class="menu-name-editor"><label class="file-label" for="menu-name">${label("menuName")}</label><input type="text" id="menu-name" value="${escape(state.preview.title)}" aria-describedby="menu-name-hint menu-name-error" autocomplete="off" spellcheck="false"><p id="menu-name-hint" class="small muted">${label("menuNameHint")}</p><p id="menu-name-error" class="small error-text" role="alert"></p><div class="menu-name-preview"><span class="small muted">${label("cartMenuPreview")}</span><canvas id="menu-title-preview" role="img"></canvas></div></section>` : ""}${operationDetails(entry)}`}
      ${state.error ? errorBanner() : ""}
      ${truncating ? "" : `<label class="verify-option"><input type="checkbox" role="switch" id="verify-readback" ${state.verifyAfterWrite ? "checked" : ""}>${label("verifyAfterWrite")}</label>`}
      <div class="dialog-actions"><button class="secondary" id="cancel-modal">${label("cancel")}</button><button class="primary ${truncating ? "danger-button" : ""}" id="write" ${!state.plan ? "disabled" : ""}>${truncating ? escape(t("confirmDelete", { count: state.plan.removed.length })) : label("confirmWrite")}</button></div>`
    }`;
  dialog.showModal();
  dialog.oncancel = (event) => {
    event.preventDefault();
    closeOperation();
  };
  document.querySelector("#close-modal").onclick = closeOperation;
  document
    .querySelector("#cancel-modal")
    ?.addEventListener("click", closeOperation);
  document
    .querySelector("#rom-file")
    ?.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      const revision = ++state.revision;
      state.plan = null;
      state.preview = null;
      state.error = null;
      if (!file) {
        render();
        return;
      }
      const preview = {
        file,
        title: file.name,
        length: Math.ceil(file.size / menuLength) * menuLength,
        error: null,
      };
      try {
        if (!/\.gba$/i.test(file.name)) throw new Error("extension");
        const header = new Uint8Array(await file.slice(0, 192).arrayBuffer());
        if (revision !== state.revision || !state.modal) return;
        if (header.length !== 192 || header[0xb2] !== 0x96)
          throw new Error("header");
        preview.title =
          new TextDecoder()
            .decode(header.subarray(0xa0, 0xac))
            .split("\0")[0]
            .replace(/[^ -~]/g, " ")
            .trim() || "GBA GAME";
        preview.title = defaultMenuTitle(file.name, preview.title);
        const allocation = allocateRom(
          state.snapshot,
          file.size,
          state.replaceSlot,
        );
        state.plan = {
          menu: state.snapshot.slice(),
          file,
          title: preview.title,
          allocation,
        };
      } catch (error) {
        preview.error = error;
      }
      if (revision === state.revision && state.modal) state.preview = preview;
      if (revision === state.revision) render();
    });
  const nameInput = document.querySelector("#menu-name");
  if (nameInput) {
    const updateName = () => {
      const name = nameInput.value;
      const error = document.querySelector("#menu-name-error");
      const canvas = document.querySelector("#menu-title-preview");
      try {
        encodeMenuTitle(name);
        const glyph = renderMenuTitle(name);
        drawMenuTitle(canvas, glyph);
        canvas.setAttribute("aria-label", name.trim());
        canvas.hidden = false;
        error.textContent = "";
        nameInput.setAttribute("aria-invalid", "false");
        state.preview.title = name.trim();
        if (state.plan) state.plan.title = name.trim();
        document.querySelector("#write").disabled = !state.plan;
        const titleValue = document.querySelector(
          ".preview dd[data-new-title]",
        );
        if (titleValue) titleValue.textContent = name.trim();
      } catch (reason) {
        canvas.hidden = true;
        error.textContent = t(reason.message);
        nameInput.setAttribute("aria-invalid", "true");
        document.querySelector("#write").disabled = true;
      }
    };
    nameInput.addEventListener("input", updateName);
    updateName();
  }
  document
    .querySelector("#verify-readback")
    ?.addEventListener("change", (event) => {
      state.verifyAfterWrite = event.target.checked;
    });
  document.querySelector("#write")?.addEventListener("click", writeOperation);
}

async function writeOperation() {
  if (!state.plan || state.busy) return;
  const plan = state.plan;
  const device = state.device;
  const verifyAfterWrite = plan.kind !== "truncate" && state.verifyAfterWrite;
  state.resultKind = plan.kind || "rom";
  state.busy = true;
  state.error = null;
  progress("checking");
  try {
    await applyPlan(device, plan, progress, { verifyAfterWrite });
    state.result = verifyAfterWrite ? "verified" : "success";
    log("complete", { operation: state.resultKind, verifyAfterWrite });
  } catch (error) {
    state.error = error;
    log("error", error.message);
    if (error.writingStarted) state.result = "recovery";
  } finally {
    state.busy = false;
    state.modal = false;
    clearCart();
    render();
  }
}

navigator.usb?.addEventListener("disconnect", ({ device }) => {
  if (device !== state.device) return;
  log("disconnect");
  // Active operations fail through their own guarded USB calls and retain the busy lock.
  if (!state.busy) {
    state.modal = false;
    state.revision++;
    clearCart();
    state.error = new DOMException("Device disconnected", "NetworkError");
    render();
  }
});
window.addEventListener("beforeunload", (event) => {
  if (state.busy) {
    event.preventDefault();
    event.returnValue = "";
  }
});
render();
