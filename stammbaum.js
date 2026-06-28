/* Stammbaum-Modul: Excel-basierte Pferdedatenbank mit Verpaarungs- und Inzuchtprüfung */

const PEDIGREE_DEPTH_OPTIONS = [4, 16];
const SHEET_NAME = "Pferde";

const EXCEL_COLUMNS = [
  "Name",
  "Geschlecht",
  "Status",
  "Vater_Name",
  "Vater_Notiz",
  "Mutter_Name",
  "Mutter_Notiz",
];

const EXAMPLE_HORSES = [
  {
    name: "Sturmwind",
    geschlecht: "stute",
    vater: "Donnerhall",
    vater_status: "",
    mutter: "Mondlicht",
    mutter_status: "",
    im_stall: true,
  },
  {
    name: "Blitzfrieden",
    geschlecht: "hengst",
    vater: "Donnerhall",
    vater_status: "",
    mutter: "Mondlicht",
    mutter_status: "",
    im_stall: true,
  },
  {
    name: "Donnerhall",
    geschlecht: "hengst",
    vater: "Blitz",
    vater_status: "",
    mutter: "Rose",
    mutter_status: "",
    im_stall: false,
  },
  {
    name: "Mondlicht",
    geschlecht: "stute",
    vater: null,
    vater_status: "fortsetzung",
    mutter: null,
    mutter_status: "foundation",
    im_stall: false,
  },
  {
    name: "Blitz",
    geschlecht: "hengst",
    vater: null,
    vater_status: "foundation",
    mutter: null,
    mutter_status: "foundation",
    im_stall: false,
  },
  {
    name: "Rose",
    geschlecht: "stute",
    vater: null,
    vater_status: "foundation",
    mutter: null,
    mutter_status: "foundation",
    im_stall: false,
  },
];

const state = {
  horses: [],
  selectedName: null,
  fileName: null,
  fileHandle: null,
  dirty: false,
};

function getPedigreeGenerations() {
  const checked = document.querySelector('input[name="pedGenDepth"]:checked');
  const n = Number(checked?.value);
  return PEDIGREE_DEPTH_OPTIONS.includes(n) ? n : 16;
}

function getPedigreeDisplayGenerations(checkDepth) {
  return Math.min(checkDepth, 8);
}

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

function rowVal(row, ...keys) {
  for (const key of keys) {
    const val = row[key];
    if (val != null && val !== "") return val;
  }
  return "";
}

function buildIdToNameMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = parseOptionalId(row.id);
    const name = String(rowVal(row, "Name", "name") ?? "").trim();
    if (id && name) map.set(id, name);
  }
  return map;
}

function parseParentFromRow(row, side, idToName) {
  const isSire = side === "sire";
  const name = String(
    rowVal(row, isSire ? "Vater_Name" : "Mutter_Name", isSire ? "vater" : "mutter") ?? ""
  ).trim();
  if (name) return { name, status: "" };

  const legacyId = parseOptionalId(row[isSire ? "vater_id" : "mutter_id"]);
  if (legacyId && idToName.has(legacyId)) {
    return { name: idToName.get(legacyId), status: "" };
  }

  const status = normalizeParentStatus(
    rowVal(row, isSire ? "Vater_Notiz" : "Mutter_Notiz", isSire ? "vater_status" : "mutter_status")
  );
  return { name: null, status: status || "foundation" };
}

function rowToHorse(row, idToName) {
  const name = String(rowVal(row, "Name", "name") ?? "").trim();
  if (!name) return null;

  const vater = parseParentFromRow(row, "sire", idToName);
  const mutter = parseParentFromRow(row, "dam", idToName);

  return {
    name,
    geschlecht: normalizeGeschlecht(rowVal(row, "Geschlecht", "geschlecht")),
    vater: vater.name,
    vater_status: vater.name ? "" : vater.status,
    mutter: mutter.name,
    mutter_status: mutter.name ? "" : mutter.status,
    im_stall: parseBoolJa(rowVal(row, "Status", "im_stall")),
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
    Name: h.name,
    Geschlecht: h.geschlecht,
    Status: h.im_stall ? "ja" : "nein",
    Vater_Name: h.vater ?? "",
    Vater_Notiz: h.vater ? "" : h.vater_status || "foundation",
    Mutter_Name: h.mutter ?? "",
    Mutter_Notiz: h.mutter ? "" : h.mutter_status || "foundation",
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
  const wb = writeWorkbook(EXAMPLE_HORSES);
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

function collectAncestorEntries(horse, byName, maxGen) {
  const entries = [];

  function walk(h, gen) {
    if (gen > maxGen) return;
    for (const side of ["sire", "dam"]) {
      const parent = resolveParent(h, side, byName);
      if (parent.kind !== "horse") continue;
      entries.push({
        name: parent.horse.name,
        nameKey: normalizeNameKey(parent.horse.name),
        generation: gen,
      });
      walk(parent.horse, gen + 1);
    }
  }

  walk(horse, 1);
  return entries;
}

function groupAncestorGenerations(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.nameKey)) map.set(e.nameKey, { name: e.name, generations: new Set() });
    map.get(e.nameKey).generations.add(e.generation);
  }
  return map;
}

function formatGenerationSet(gens, side) {
  const sorted = [...gens].sort((a, b) => a - b);
  return sorted
    .map((g) => {
      if (g === 0) return side === "sire" ? "Verpaarungspartner (Hengst)" : "Verpaarungspartner (Stute)";
      return `Gen ${g}`;
    })
    .join(", ");
}

function closestOverlapDistance(overlap) {
  return Math.min(...overlap.sireGenerations) + Math.min(...overlap.damGenerations);
}

function pickClosestOverlap(overlaps) {
  if (!overlaps.length) return null;
  return [...overlaps].sort((a, b) => {
    const distDiff = closestOverlapDistance(a) - closestOverlapDistance(b);
    if (distDiff !== 0) return distDiff;
    return a.minGen - b.minGen || a.name.localeCompare(b.name, "de");
  })[0];
}

function analyzePairInbreeding(stallion, mare, horses, maxGen) {
  const byName = horsesByName(horses);
  const stallionKey = normalizeNameKey(stallion.name);
  const mareKey = normalizeNameKey(mare.name);

  const directIssues = [];
  if (stallionKey === mareKey) {
    directIssues.push("Stute und Hengst sind dasselbe Pferd.");
  }

  const sireEntries = collectAncestorEntries(stallion, byName, maxGen);
  const damEntries = collectAncestorEntries(mare, byName, maxGen);
  const sireMap = groupAncestorGenerations(sireEntries);
  const damMap = groupAncestorGenerations(damEntries);

  const overlaps = [];

  if (damMap.has(stallionKey)) {
    overlaps.push({
      name: stallion.name,
      nameKey: stallionKey,
      sireGenerations: new Set([0]),
      damGenerations: damMap.get(stallionKey).generations,
      minGen: 0,
    });
  }
  if (sireMap.has(mareKey)) {
    overlaps.push({
      name: mare.name,
      nameKey: mareKey,
      sireGenerations: sireMap.get(mareKey).generations,
      damGenerations: new Set([0]),
      minGen: 0,
    });
  }

  for (const [key, sireData] of sireMap.entries()) {
    if (key === stallionKey || key === mareKey) continue;
    const damData = damMap.get(key);
    if (!damData) continue;
    overlaps.push({
      name: sireData.name,
      nameKey: key,
      sireGenerations: sireData.generations,
      damGenerations: damData.generations,
      minGen: Math.min(...sireData.generations, ...damData.generations),
    });
  }

  const closestOverlap = pickClosestOverlap(overlaps);
  const overlapKeys = closestOverlap ? new Set([closestOverlap.nameKey]) : new Set();
  return { directIssues, closestOverlap, overlapKeys, maxGen };
}

function treeParent(node, side, byName) {
  if (node.kind === "foal") {
    if (side === "sire") {
      return node.stallion
        ? { kind: "horse", horse: node.stallion }
        : { kind: "placeholder", label: "Hengst wählen" };
    }
    return node.mare
      ? { kind: "horse", horse: node.mare }
      : { kind: "placeholder", label: "Stute wählen" };
  }
  if (node.kind === "horse") return resolveParent(node.horse, side, byName);
  return { kind: "foundation", label: "Foundation" };
}

function buildPedigreeCells(root, displayGen, byName) {
  const totalRows = 1 << displayGen;
  const cells = [];

  function visit(node, gen, rowStart, rowSpan) {
    cells.push({ gen, rowStart, rowSpan, node });
    if (gen >= displayGen) return;
    const half = rowSpan / 2;
    visit(treeParent(node, "sire", byName), gen + 1, rowStart, half);
    visit(treeParent(node, "dam", byName), gen + 1, rowStart + half, half);
  }

  visit(root, 0, 0, totalRows);
  return { cells, totalRows, totalCols: displayGen + 1 };
}

function renderNodeContent(node, highlightKeys) {
  if (node.kind === "foal") {
    const parts = [];
    if (node.stallion) parts.push(`Vater: ${node.stallion.name}`);
    if (node.mare) parts.push(`Mutter: ${node.mare.name}`);
    const meta = parts.length ? `<div class="pedMeta">${stEscapeHtml(parts.join(" · "))}</div>` : "";
    return `<div class="pedNode pedFoal">
      <div class="pedName">Geplantes Fohlen</div>
      ${meta}
    </div>`;
  }

  if (node.kind === "horse") {
    const h = node.horse;
    const isOverlap = highlightKeys?.has(normalizeNameKey(h.name));
    const cls = [
      "pedNode",
      "pedHorse",
      h.im_stall ? "pedInStall" : "",
      isOverlap ? "pedOverlap" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<div class="${cls}">
      <div class="pedName">${stEscapeHtml(h.name)}</div>
      <div class="pedMeta">${stEscapeHtml(geschlechtLabel(h.geschlecht))}</div>
    </div>`;
  }

  if (node.kind === "placeholder") {
    return `<div class="pedNode pedPlaceholder"><div class="pedName">${stEscapeHtml(node.label)}</div></div>`;
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

function renderFoalPedigreeChart(host, stallion, mare, checkDepth, highlightKeys) {
  if (!host) return;
  if (!stallion && !mare) {
    host.innerHTML = `<p class="muted">—</p>`;
    return;
  }

  const displayGen = getPedigreeDisplayGenerations(checkDepth);
  const root = { kind: "foal", stallion, mare };
  const byName = horsesByName(state.horses);
  const { cells, totalRows, totalCols } = buildPedigreeCells(root, displayGen, byName);

  let title = "Stammbaum des geplanten Fohlens";
  if (stallion && mare) title += ` (${stallion.name} × ${mare.name})`;
  else if (stallion) title += ` — Vater: ${stallion.name}`;
  else title += ` — Mutter: ${mare.name}`;

  const truncNote =
    checkDepth > displayGen
      ? `<p class="pedChartNote muted">Anzeige: ${displayGen} Generationen · Prüfung bis Gen ${checkDepth}</p>`
      : "";

  const gridHtml = cells
    .map(({ gen, rowStart, rowSpan, node }) => {
      const fork =
        gen < displayGen
          ? `<div class="pedChartBridge" aria-hidden="true"><span class="pedChartLineH"></span><span class="pedChartLineV"></span></div>`
          : "";
      const childLine = gen > 0 ? `<span class="pedChartLineIn" aria-hidden="true"></span>` : "";
      return `<div class="pedChartCell${gen > 0 ? " pedChartCellChild" : ""}" style="--c:${gen + 1};--r:${rowStart + 1};--rs:${rowSpan}">
        <div class="pedChartCellInner">
          ${childLine}
          ${renderNodeContent(node, highlightKeys)}
          ${fork}
        </div>
      </div>`;
    })
    .join("");

  host.innerHTML = `
    <h3>${stEscapeHtml(title)}</h3>
    ${truncNote}
    <div class="pedScroll">
      <div class="pedChart" style="--cols:${totalCols};--rows:${totalRows}">${gridHtml}</div>
    </div>
  `;
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
  };
  state.horses.push(horse);
  state.horses.sort((a, b) => a.name.localeCompare(b.name, "de"));
  state.selectedName = name;
  markDirty();
  renderAll();
}

function stallHorsesByRole(role) {
  const stall = state.horses.filter((h) => h.im_stall);
  if (role === "mare") return stall.filter((h) => h.geschlecht === "stute");
  if (role === "stallion") return stall.filter((h) => h.geschlecht === "hengst");
  return stall;
}

function renderPairSelects() {
  const mareSel = document.getElementById("pedPairMare");
  const stallionSel = document.getElementById("pedPairStallion");
  if (!mareSel || !stallionSel) return;

  const prevMare = mareSel.value;
  const prevStallion = stallionSel.value;
  const mares = stallHorsesByRole("mare");
  const stallions = stallHorsesByRole("stallion");

  mareSel.innerHTML =
    `<option value="">— Stute wählen —</option>` +
    mares
      .map((h) => {
        const sel = h.name === prevMare ? " selected" : "";
        return `<option value="${stEscapeHtml(h.name)}"${sel}>${stEscapeHtml(h.name)}</option>`;
      })
      .join("");

  stallionSel.innerHTML =
    `<option value="">— Hengst wählen —</option>` +
    stallions
      .map((h) => {
        const sel = h.name === prevStallion ? " selected" : "";
        return `<option value="${stEscapeHtml(h.name)}"${sel}>${stEscapeHtml(h.name)}</option>`;
      })
      .join("");

  if (prevMare && mares.some((h) => h.name === prevMare)) mareSel.value = prevMare;
  if (prevStallion && stallions.some((h) => h.name === prevStallion)) stallionSel.value = prevStallion;
}

function getPairSelection() {
  const mareName = document.getElementById("pedPairMare")?.value || "";
  const stallionName = document.getElementById("pedPairStallion")?.value || "";
  const mare = mareName ? findHorseByName(state.horses, mareName) : null;
  const stallion = stallionName ? findHorseByName(state.horses, stallionName) : null;
  return { mare, stallion };
}

function getPairAnalysis() {
  const { mare, stallion } = getPairSelection();
  const maxGen = getPedigreeGenerations();

  if (!mare && !stallion) return null;

  if (mare && stallion) {
    return { mare, stallion, maxGen, complete: true, ...analyzePairInbreeding(stallion, mare, state.horses, maxGen) };
  }

  return { mare, stallion, maxGen, complete: false, overlapKeys: new Set() };
}

function renderPairTrees(ctx) {
  const treesHost = document.getElementById("pedPairTrees");
  if (!treesHost) return;

  const { mare, stallion, maxGen, overlapKeys } = ctx;
  if (!mare && !stallion) {
    treesHost.classList.add("hidden");
    treesHost.innerHTML = "";
    return;
  }

  treesHost.classList.remove("hidden");
  treesHost.innerHTML = `<div class="pedPairPanel pedPairPanelFull" id="pedFoalTreeHost"></div>`;
  renderFoalPedigreeChart(
    document.getElementById("pedFoalTreeHost"),
    stallion,
    mare,
    maxGen,
    overlapKeys
  );
}

function renderInbreedingCheck(ctx) {
  const host = document.getElementById("pedInbreedingResult");
  if (!host) return;

  if (!ctx) {
    host.className = "pedInbreedingResult muted";
    host.textContent = "Wähle Stute und/oder Hengst für die Inzuchtprüfung.";
    renderPairTrees({ mare: null, stallion: null, maxGen: getPedigreeGenerations(), overlapKeys: new Set() });
    return;
  }

  renderPairTrees(ctx);

  if (!ctx.complete) {
    host.className = "pedInbreedingResult muted";
    if (ctx.mare && !ctx.stallion) {
      host.textContent = `Stammbaum des geplanten Fohlens — wähle noch einen Hengst für die Inzuchtprüfung.`;
    } else {
      host.textContent = `Stammbaum des geplanten Fohlens — wähle noch eine Stute für die Inzuchtprüfung.`;
    }
    return;
  }

  const { mare, stallion, directIssues, closestOverlap, maxGen } = ctx;
  const hasWarning = directIssues.length > 0 || closestOverlap != null;

  if (!hasWarning) {
    host.className = "pedInbreedingResult pedInbreedingOk";
    host.innerHTML = `<b>Keine Inzucht erkannt</b> zwischen „${stEscapeHtml(stallion.name)}" und „${stEscapeHtml(mare.name)}" (bis Gen ${maxGen}).`;
    return;
  }

  host.className = "pedInbreedingResult pedInbreedingWarn";
  let html = `<b>Inzuchtwarnung</b> für „${stEscapeHtml(stallion.name)}" × „${stEscapeHtml(mare.name)}":`;

  if (closestOverlap) {
    html += `<ul><li><b>${stEscapeHtml(closestOverlap.name)}</b> — nächster gemeinsamer Vorfahr · Hengst-Linie: ${formatGenerationSet(closestOverlap.sireGenerations, "sire")} · Stuten-Linie: ${formatGenerationSet(closestOverlap.damGenerations, "dam")}</li></ul>`;
  } else if (directIssues.length > 0) {
    html += `<ul>${directIssues.map((d) => `<li>${stEscapeHtml(d)}</li>`).join("")}</ul>`;
  }

  host.innerHTML = html;
}

function renderAll() {
  updateFileStatus();
  renderPairSelects();
  renderInbreedingCheck(getPairAnalysis());
}

function initStammbaum() {
  document.getElementById("pedOpenBtn")?.addEventListener("click", openExcelFile);
  document.getElementById("pedSaveBtn")?.addEventListener("click", saveExcelFile);
  document.getElementById("pedTemplateBtn")?.addEventListener("click", downloadTemplate);
  document.getElementById("pedAddBtn")?.addEventListener("click", addNewHorse);
  document.getElementById("pedFileInput")?.addEventListener("change", onFileInputChange);
  document.querySelectorAll('input[name="pedGenDepth"]').forEach((el) => {
    el.addEventListener("change", renderAll);
  });
  document.getElementById("pedPairMare")?.addEventListener("change", renderAll);
  document.getElementById("pedPairStallion")?.addEventListener("change", renderAll);

  updateFileStatus();
  renderAll();
}

document.addEventListener("DOMContentLoaded", initStammbaum);
