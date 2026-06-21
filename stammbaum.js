/* Stammbaum-Modul: Excel-basierte Pferdedatenbank mit 8-Generationen-Ansicht */

const PEDIGREE_GENERATIONS = 8;
const SHEET_NAME = "Pferde";

const EXCEL_COLUMNS = [
  "name",
  "geschlecht",
  "vater",
  "vater_status",
  "mutter",
  "mutter_status",
  "im_stall",
  "notizen",
];

const EXAMPLE_HORSES = [
  {
    name: "Sturmwind",
    geschlecht: "stute",
    vater: "Donnerhall",
    vater_status: "",
    mutter: "Mondlicht",
    mutter_status: "",
    im_stall: "ja",
    notizen: "Beispiel – im Stall",
  },
  {
    name: "Donnerhall",
    geschlecht: "hengst",
    vater: "Blitz",
    vater_status: "",
    mutter: "Rose",
    mutter_status: "",
    im_stall: "nein",
    notizen: "",
  },
  {
    name: "Mondlicht",
    geschlecht: "stute",
    vater: "",
    vater_status: "fortsetzung",
    mutter: "",
    mutter_status: "foundation",
    im_stall: "nein",
    notizen: "Vater existiert im Spiel, nicht eingetragen",
  },
  {
    name: "Blitz",
    geschlecht: "hengst",
    vater: "",
    vater_status: "foundation",
    mutter: "",
    mutter_status: "foundation",
    im_stall: "nein",
    notizen: "Foundation-Hengst",
  },
  {
    name: "Rose",
    geschlecht: "stute",
    vater: "",
    vater_status: "foundation",
    mutter: "",
    mutter_status: "foundation",
    im_stall: "nein",
    notizen: "Foundation-Stute",
  },
];

const state = {
  horses: [],
  selectedName: null,
  fileName: null,
  fileHandle: null,
  dirty: false,
};

function stEscapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseBoolJa(val) {
  const v = String(val ?? "")
    .trim()
    .toLowerCase();
  return v === "ja" || v === "j" || v === "1" || v === "true" || v === "x";
}

function parseOptionalId(val) {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normalizeParentStatus(val) {
  const v = String(val ?? "")
    .trim()
    .toLowerCase();
  if (v === "foundation") return "foundation";
  if (v === "fortsetzung") return "fortsetzung";
  return "";
}

function normalizeGeschlecht(val) {
  const v = String(val ?? "")
    .trim()
    .toLowerCase();
  if (v === "hengst" || v === "h") return "hengst";
  if (v === "stute" || v === "s") return "stute";
  if (v === "wallach" || v === "w") return "wallach";
  return v || "stute";
}

function geschlechtLabel(g) {
  if (g === "hengst") return "Hengst";
  if (g === "wallach") return "Wallach";
  return "Stute";
}

function normalizeNameKey(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase();
}

function horsesByName(horses) {
  return new Map(horses.map((h) => [normalizeNameKey(h.name), h]));
}

function findHorseByName(horses, name) {
  if (!name) return null;
  return horsesByName(horses).get(normalizeNameKey(name)) ?? null;
}

function uniqueName(baseName, horses, excludeHorse = null) {
  const keys = new Set(
    horses.filter((h) => h !== excludeHorse).map((h) => normalizeNameKey(h.name))
  );
  if (!keys.has(normalizeNameKey(baseName))) return baseName;
  let i = 2;
  while (keys.has(normalizeNameKey(`${baseName} ${i}`))) i++;
  return `${baseName} ${i}`;
}

function markDirty() {
  state.dirty = true;
  updateFileStatus();
}

function clearDirty() {
  state.dirty = false;
  updateFileStatus();
}

function updateFileStatus() {
  const el = document.getElementById("pedFileStatus");
  if (!el) return;
  const name = state.fileName ?? "Keine Datei geöffnet";
  const unsaved = state.dirty ? " · ungespeicherte Änderungen" : "";
  el.textContent = `${name}${unsaved}`;
}

function buildIdToNameMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = parseOptionalId(row.id);
    const name = String(row.name ?? "").trim();
    if (id && name) map.set(id, name);
  }
  return map;
}

function parseParentFromRow(row, side, idToName) {
  const isSire = side === "sire";
  const name = String(row[isSire ? "vater" : "mutter"] ?? "").trim();
  if (name) return { name, status: "" };

  const legacyId = parseOptionalId(row[isSire ? "vater_id" : "mutter_id"]);
  if (legacyId && idToName.has(legacyId)) {
    return { name: idToName.get(legacyId), status: "" };
  }

  const status = normalizeParentStatus(row[isSire ? "vater_status" : "mutter_status"]);
  return { name: null, status: status || "foundation" };
}

function rowToHorse(row, idToName) {
  const name = String(row.name ?? "").trim();
  if (!name) return null;

  const vater = parseParentFromRow(row, "sire", idToName);
  const mutter = parseParentFromRow(row, "dam", idToName);

  return {
    name,
    geschlecht: normalizeGeschlecht(row.geschlecht),
    vater: vater.name,
    vater_status: vater.name ? "" : vater.status,
    mutter: mutter.name,
    mutter_status: mutter.name ? "" : mutter.status,
    im_stall: parseBoolJa(row.im_stall),
    notizen: String(row.notizen ?? "").trim(),
  };
}

function horsesFromSheetRows(rows) {
  const idToName = buildIdToNameMap(rows);
  const horses = [];
  for (const row of rows) {
    const h = rowToHorse(row, idToName);
    if (h) horses.push(h);
  }
  horses.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return horses;
}

function findDuplicateNames(horses) {
  const seen = new Map();
  const dupes = [];
  for (const h of horses) {
    const key = normalizeNameKey(h.name);
    if (seen.has(key)) dupes.push(h.name);
    else seen.set(key, h.name);
  }
  return dupes;
}

function horseToRow(h) {
  return {
    name: h.name,
    geschlecht: h.geschlecht,
    vater: h.vater ?? "",
    vater_status: h.vater ? "" : h.vater_status || "foundation",
    mutter: h.mutter ?? "",
    mutter_status: h.mutter ? "" : h.mutter_status || "foundation",
    im_stall: h.im_stall ? "ja" : "nein",
    notizen: h.notizen ?? "",
  };
}

function readWorkbookFromArrayBuffer(buf) {
  if (typeof XLSX === "undefined") throw new Error("Excel-Bibliothek (SheetJS) nicht geladen.");
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[SHEET_NAME] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error(`Blatt „${SHEET_NAME}“ nicht gefunden.`);
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const horses = horsesFromSheetRows(rows);
  const dupes = findDuplicateNames(horses);
  if (dupes.length > 0) {
    throw new Error(`Doppelte Pferdenamen gefunden: ${dupes.join(", ")}. Namen müssen eindeutig sein.`);
  }
  return horses;
}

function writeWorkbook(horses) {
  if (typeof XLSX === "undefined") throw new Error("Excel-Bibliothek (SheetJS) nicht geladen.");
  const rows = horses.map(horseToRow);
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXCEL_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  return wb;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function workbookToBlob(wb) {
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function loadFromArrayBuffer(buf, fileName, fileHandle = null) {
  state.horses = readWorkbookFromArrayBuffer(buf);
  state.fileName = fileName;
  state.fileHandle = fileHandle;
  state.selectedName =
    state.horses.find((h) => h.im_stall)?.name ?? state.horses[0]?.name ?? null;
  clearDirty();
  renderAll();
}

async function openExcelFile() {
  try {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Excel",
            accept: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            },
          },
        ],
      });
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      await loadFromArrayBuffer(buf, file.name, handle);
      return;
    }
  } catch (e) {
    if (e?.name === "AbortError") return;
    if (e instanceof Error && e.message.includes("Doppelte")) {
      alert(e.message);
      return;
    }
    console.warn("showOpenFilePicker fehlgeschlagen, Fallback:", e);
  }

  document.getElementById("pedFileInput")?.click();
}

async function onFileInputChange(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    await loadFromArrayBuffer(buf, file.name, null);
  } catch (e) {
    alert(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden.");
  }
  ev.target.value = "";
}

async function saveExcelFile() {
  if (state.horses.length === 0) {
    alert("Keine Pferdedaten zum Speichern.");
    return;
  }
  const dupes = findDuplicateNames(state.horses);
  if (dupes.length > 0) {
    alert(`Doppelte Namen verhindern das Speichern: ${dupes.join(", ")}`);
    return;
  }
  const wb = writeWorkbook(state.horses);
  const blob = workbookToBlob(wb);
  const name = state.fileName ?? "pferde.xlsx";

  try {
    if (state.fileHandle) {
      const writable = await state.fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      clearDirty();
      return;
    }
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: "Excel",
            accept: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      state.fileHandle = handle;
      state.fileName = handle.name;
      clearDirty();
      return;
    }
  } catch (e) {
    if (e?.name === "AbortError") return;
    console.warn("Speichern via File System API fehlgeschlagen:", e);
  }

  downloadBlob(blob, name);
  clearDirty();
}

function downloadTemplate() {
  const wb = writeWorkbook(
    EXAMPLE_HORSES.map((h) => ({
      ...h,
      im_stall: parseBoolJa(h.im_stall),
      vater: h.vater || null,
      mutter: h.mutter || null,
      vater_status: h.vater ? "" : h.vater_status,
      mutter_status: h.mutter ? "" : h.mutter_status,
      notizen: h.notizen ?? "",
    }))
  );
  downloadBlob(workbookToBlob(wb), "pferde-vorlage.xlsx");
}

function resolveParent(horse, side, byName) {
  const isSire = side === "sire";
  const parentName = isSire ? horse.vater : horse.mutter;
  const status = isSire ? horse.vater_status : horse.mutter_status;

  if (parentName) {
    const linked = byName.get(normalizeNameKey(parentName));
    if (linked) return { kind: "horse", horse: linked };
    return { kind: "missing", label: `„${parentName}" fehlt` };
  }
  if (status === "fortsetzung") return { kind: "fortsetzung", label: "… (weiter)" };
  if (status === "foundation") return { kind: "foundation", label: "Foundation" };
  return { kind: "foundation", label: "Foundation" };
}

function renderPedigreeNode(node, depth) {
  if (depth > PEDIGREE_GENERATIONS) return "";

  if (node.kind === "horse") {
    const h = node.horse;
    const cls = h.im_stall ? "pedNode pedHorse pedInStall" : "pedNode pedHorse";
    let html = `<div class="${cls}">
      <div class="pedName">${stEscapeHtml(h.name)}</div>
      <div class="pedMeta">${stEscapeHtml(geschlechtLabel(h.geschlecht))}</div>
    </div>`;

    if (depth < PEDIGREE_GENERATIONS) {
      const byName = horsesByName(state.horses);
      const sire = resolveParent(h, "sire", byName);
      const dam = resolveParent(h, "dam", byName);
      html += `<div class="pedParents">
        <div class="pedBranch pedBranchSire">${renderPedigreeNode(sire, depth + 1)}</div>
        <div class="pedBranch pedBranchDam">${renderPedigreeNode(dam, depth + 1)}</div>
      </div>`;
    }
    return html;
  }

  if (node.kind === "foundation") {
    return `<div class="pedNode pedFoundation"><div class="pedName">Foundation</div></div>`;
  }
  if (node.kind === "fortsetzung") {
    return `<div class="pedNode pedFortsetzung">
      <div class="pedName">… (weiter)</div>
      <div class="pedMeta">nicht eingetragen</div>
    </div>`;
  }
  return `<div class="pedNode pedMissing"><div class="pedName">${stEscapeHtml(node.label)}</div></div>`;
}

function renderPedigreeTree(focusHorse) {
  const host = document.getElementById("pedTree");
  if (!host) return;

  if (!focusHorse) {
    host.innerHTML = `<p class="muted">Wähle ein Pferd aus deinem Stall.</p>`;
    host.classList.add("muted");
    return;
  }

  host.classList.remove("muted");
  const root = { kind: "horse", horse: focusHorse };
  host.innerHTML = `<div class="pedScroll"><div class="pedTreeRoot">${renderPedigreeNode(root, 0)}</div></div>`;
}

function renderHorseList() {
  const list = document.getElementById("pedHorseList");
  if (!list) return;

  if (state.horses.length === 0) {
    list.innerHTML = `<p class="muted">Noch keine Pferde. Excel-Datei öffnen oder Vorlage laden.</p>`;
    return;
  }

  const rows = state.horses
    .map((h) => {
      const active =
        normalizeNameKey(h.name) === normalizeNameKey(state.selectedName) ? " pedListItemActive" : "";
      const stall = h.im_stall ? `<span class="pill">Stall</span>` : "";
      return `<button type="button" class="pedListItem${active}" data-name="${stEscapeHtml(h.name)}">
        <span class="pedListName">${stEscapeHtml(h.name)}</span>
        <span class="pedListMeta">${stEscapeHtml(geschlechtLabel(h.geschlecht))} ${stall}</span>
      </button>`;
    })
    .join("");

  list.innerHTML = rows;
  list.querySelectorAll(".pedListItem").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedName = btn.dataset.name ?? null;
      renderAll();
    });
  });
}

function parentSelectOptions(horses, side, currentHorseName, currentParentName, currentStatus) {
  const want = side === "sire" ? ["hengst", "wallach"] : ["stute"];
  let html = `<option value="">— Auswahl —</option>`;
  html += `<option value="foundation"${!currentParentName && currentStatus === "foundation" ? " selected" : ""}>Foundation (Stammbaum-Ende)</option>`;
  html += `<option value="fortsetzung"${!currentParentName && currentStatus === "fortsetzung" ? " selected" : ""}>… Fortsetzung (nicht eingetragen)</option>`;
  html += `<option disabled>──────────</option>`;

  for (const h of horses) {
    if (normalizeNameKey(h.name) === normalizeNameKey(currentHorseName)) continue;
    if (!want.includes(h.geschlecht)) continue;
    const sel =
      currentParentName && normalizeNameKey(currentParentName) === normalizeNameKey(h.name)
        ? " selected"
        : "";
    html += `<option value="horse:${encodeURIComponent(h.name)}"${sel}>${stEscapeHtml(h.name)}</option>`;
  }
  return html;
}

function readParentSelectValue(raw) {
  if (!raw || raw === "foundation") return { name: null, status: "foundation" };
  if (raw === "fortsetzung") return { name: null, status: "fortsetzung" };
  if (raw.startsWith("horse:")) {
    const name = decodeURIComponent(raw.slice(6)).trim();
    return { name: name || null, status: "" };
  }
  return { name: null, status: "foundation" };
}

function renderHorseEditor() {
  const editor = document.getElementById("pedEditor");
  if (!editor) return;

  const horse = state.horses.find(
    (h) => normalizeNameKey(h.name) === normalizeNameKey(state.selectedName)
  );
  if (!horse) {
    editor.innerHTML = `<p class="muted">Pferd aus der Liste wählen oder neu anlegen.</p>`;
    return;
  }

  editor.innerHTML = `
    <div class="formRow">
      <label for="pedEditName">Name</label>
      <input id="pedEditName" class="textInput" type="text" value="${stEscapeHtml(horse.name)}" />
    </div>
    <div class="formRow">
      <label for="pedEditGeschlecht">Geschlecht</label>
      <select id="pedEditGeschlecht">
        <option value="stute"${horse.geschlecht === "stute" ? " selected" : ""}>Stute</option>
        <option value="hengst"${horse.geschlecht === "hengst" ? " selected" : ""}>Hengst</option>
        <option value="wallach"${horse.geschlecht === "wallach" ? " selected" : ""}>Wallach</option>
      </select>
    </div>
    <div class="formRow">
      <label for="pedEditVater">Vater</label>
      <select id="pedEditVater">${parentSelectOptions(state.horses, "sire", horse.name, horse.vater, horse.vater_status)}</select>
    </div>
    <div class="formRow">
      <label for="pedEditMutter">Mutter</label>
      <select id="pedEditMutter">${parentSelectOptions(state.horses, "dam", horse.name, horse.mutter, horse.mutter_status)}</select>
    </div>
    <div class="formRow">
      <label class="check">
        <input id="pedEditImStall" type="checkbox"${horse.im_stall ? " checked" : ""} />
        Im Stall (in Dropdown-Auswahl)
      </label>
    </div>
    <div class="formRow">
      <label for="pedEditNotizen">Notizen</label>
      <textarea id="pedEditNotizen" class="textarea" rows="3">${stEscapeHtml(horse.notizen)}</textarea>
    </div>
    <div class="actions">
      <button id="pedSaveHorseBtn" class="primary" type="button">Änderungen übernehmen</button>
      <button id="pedDeleteHorseBtn" class="secondary" type="button">Löschen</button>
    </div>
  `;

  document.getElementById("pedSaveHorseBtn")?.addEventListener("click", saveHorseFromEditor);
  document.getElementById("pedDeleteHorseBtn")?.addEventListener("click", deleteSelectedHorse);
}

function saveHorseFromEditor() {
  const horse = state.horses.find(
    (h) => normalizeNameKey(h.name) === normalizeNameKey(state.selectedName)
  );
  if (!horse) return;

  const newName = document.getElementById("pedEditName")?.value.trim();
  if (!newName) {
    alert("Bitte einen Namen eingeben.");
    return;
  }

  const vaterRaw = document.getElementById("pedEditVater")?.value ?? "foundation";
  const mutterRaw = document.getElementById("pedEditMutter")?.value ?? "foundation";
  const vater = readParentSelectValue(vaterRaw);
  const mutter = readParentSelectValue(mutterRaw);

  if (
    (vater.name && normalizeNameKey(vater.name) === normalizeNameKey(newName)) ||
    (mutter.name && normalizeNameKey(mutter.name) === normalizeNameKey(newName))
  ) {
    alert("Ein Pferd kann nicht sein eigener Elternteil sein.");
    return;
  }

  if (
    normalizeNameKey(newName) !== normalizeNameKey(horse.name) &&
    findHorseByName(state.horses, newName)
  ) {
    alert(`Der Name „${newName}" ist bereits vergeben.`);
    return;
  }

  const oldName = horse.name;
  if (normalizeNameKey(oldName) !== normalizeNameKey(newName)) {
    for (const h of state.horses) {
      if (h.vater && normalizeNameKey(h.vater) === normalizeNameKey(oldName)) h.vater = newName;
      if (h.mutter && normalizeNameKey(h.mutter) === normalizeNameKey(oldName)) h.mutter = newName;
    }
    if (normalizeNameKey(state.selectedName) === normalizeNameKey(oldName)) {
      state.selectedName = newName;
    }
  }

  horse.name = newName;
  horse.geschlecht = normalizeGeschlecht(document.getElementById("pedEditGeschlecht")?.value);
  horse.vater = vater.name;
  horse.vater_status = vater.status;
  horse.mutter = mutter.name;
  horse.mutter_status = mutter.status;
  horse.im_stall = document.getElementById("pedEditImStall")?.checked ?? false;
  horse.notizen = document.getElementById("pedEditNotizen")?.value.trim() ?? "";

  state.horses.sort((a, b) => a.name.localeCompare(b.name, "de"));
  markDirty();
  renderAll();
}

function deleteSelectedHorse() {
  if (!state.selectedName) return;
  const horse = state.horses.find(
    (h) => normalizeNameKey(h.name) === normalizeNameKey(state.selectedName)
  );
  if (!horse) return;

  const refs = state.horses.filter(
    (h) =>
      (h.vater && normalizeNameKey(h.vater) === normalizeNameKey(horse.name)) ||
      (h.mutter && normalizeNameKey(h.mutter) === normalizeNameKey(horse.name))
  );
  let msg = `„${horse.name}" wirklich löschen?`;
  if (refs.length > 0) {
    msg += `\n\n${refs.length} Pferd(er) verweisen noch auf dieses Tier als Elternteil.`;
  }
  if (!confirm(msg)) return;

  state.horses = state.horses.filter(
    (h) => normalizeNameKey(h.name) !== normalizeNameKey(horse.name)
  );
  state.selectedName = state.horses[0]?.name ?? null;
  markDirty();
  renderAll();
}

function addNewHorse() {
  const name = uniqueName("Neues Pferd", state.horses);
  const horse = {
    name,
    geschlecht: "stute",
    vater: null,
    vater_status: "foundation",
    mutter: null,
    mutter_status: "foundation",
    im_stall: true,
    notizen: "",
  };
  state.horses.push(horse);
  state.horses.sort((a, b) => a.name.localeCompare(b.name, "de"));
  state.selectedName = name;
  markDirty();
  renderAll();
}

function renderFocusSelect() {
  const sel = document.getElementById("pedFocusSelect");
  if (!sel) return;

  const stallHorses = state.horses.filter((h) => h.im_stall);
  const prev = sel.value;

  sel.innerHTML =
    `<option value="">— Pferd wählen —</option>` +
    stallHorses
      .map((h) => {
        const selected = h.name === prev ? " selected" : "";
        return `<option value="${stEscapeHtml(h.name)}"${selected}>${stEscapeHtml(h.name)} (${geschlechtLabel(h.geschlecht)})</option>`;
      })
      .join("");

  if (prev && stallHorses.some((h) => h.name === prev)) {
    sel.value = prev;
  } else if (stallHorses.length === 1) {
    sel.value = stallHorses[0].name;
  }
}

function renderAll() {
  updateFileStatus();
  renderHorseList();
  renderHorseEditor();
  renderFocusSelect();

  const focusName = document.getElementById("pedFocusSelect")?.value || null;
  const focusHorse = focusName ? findHorseByName(state.horses, focusName) : null;
  renderPedigreeTree(focusHorse);
}

function initStammbaum() {
  document.getElementById("pedOpenBtn")?.addEventListener("click", openExcelFile);
  document.getElementById("pedSaveBtn")?.addEventListener("click", saveExcelFile);
  document.getElementById("pedTemplateBtn")?.addEventListener("click", downloadTemplate);
  document.getElementById("pedAddBtn")?.addEventListener("click", addNewHorse);
  document.getElementById("pedFileInput")?.addEventListener("change", onFileInputChange);
  document.getElementById("pedFocusSelect")?.addEventListener("change", renderAll);

  updateFileStatus();
  renderAll();
}

document.addEventListener("DOMContentLoaded", initStammbaum);
