const LOCI = [
  // Reihenfolge passend zur UI:
  // Extension, Agouti, Dun, (Cream/Pearl), Champagne, Grey, Silver, Overo, Splashed White, Appaloosa, PATN1, KIT, Flaxen, Sooty, Rabicano
  {
    key: "E",
    label: "Extension (E/e)",
    alleleOrder: ["E", "e"],
    genotypes: ["EE", "Ee", "ee"],
  },
  {
    key: "A",
    label: "Agouti (Ap, A1, At, a0)",
    alleleOrder: ["Ap", "A1", "At", "a0"], // Dominanz: Ap > A1 > At > a0
    genotypes: [
      "ApAp",
      "ApA1",
      "ApAt",
      "Apa0",
      "A1A1",
      "A1At",
      "A1a0",
      "AtAt",
      "Ata0",
      "a0a0",
    ],
  },
  {
    key: "D",
    label: "Dun (D/d)",
    alleleOrder: ["D", "d"],
    genotypes: ["DD", "Dd", "dd"],
    allowBlank: true,
  },
  {
    key: "CrPrl",
    label: "Cream / Pearl (Cr/cr/pl)",
    alleleOrder: ["Cr", "cr", "pl"],
    // mögliche Kombis: crcr, crprl, Crcr, Crprl, CrCr, prlprl
    // (Reihenfolge wird intern via alleleOrder normalisiert)
    genotypes: ["CrCr", "Crcr", "Crpl", "crcr", "crpl", "plpl"],
    allowBlank: true,
  },
  {
    key: "Ch",
    label: "Champagne (Ch/ch)",
    alleleOrder: ["Ch", "ch"],
    genotypes: ["ChCh", "Chch", "chch"],
    allowBlank: true,
  },
  {
    key: "G",
    label: "Grey (G/g)",
    alleleOrder: ["G", "g"],
    genotypes: ["GG", "Gg", "gg"],
    allowBlank: true,
  },
  {
    key: "Z",
    label: "Silver (Z/z)",
    alleleOrder: ["Z", "z"],
    genotypes: ["ZZ", "Zz", "zz"],
    allowBlank: true,
  },
  {
    key: "O",
    label: "Overo (O/o)",
    alleleOrder: ["O", "o"],
    genotypes: ["OO", "Oo", "oo"],
    allowBlank: true,
  },
  {
    key: "SPL",
    label: "Splashed White (SPL/spl)",
    alleleOrder: ["SPL", "spl"],
    genotypes: ["SPLSPL", "SPLspl", "splspl"],
    allowBlank: true,
  },
  {
    key: "LP",
    label: "Appaloosa (LP/lp)",
    alleleOrder: ["LP", "lp"],
    genotypes: ["LPLP", "LPlp", "lplp"],
    allowBlank: true,
  },
  {
    key: "PATN1",
    label: "PATN1 (P1/p1)",
    alleleOrder: ["P1", "p1"],
    genotypes: ["P1P1", "P1p1", "p1p1"],
    allowBlank: true,
  },
  {
    key: "KIT",
    label: "KIT (TO/WI/Rn/SB/0)",
    alleleOrder: ["WI", "TO", "Rn", "SB", "0"],
    genotypes: [
      "00",
      "TO0",
      "WI0",
      "Rn0",
      "SB0",
      "TOTO",
      "TOWI",
      "TORn",
      "TOSB",
      "WIWI",
      "WIRn",
      "WISB",
      "RnRn",
      "RnSB",
      "SBSB",
    ],
    allowBlank: true,
  },
  {
    key: "Fl",
    label: "Flaxen (Fl/fl)",
    alleleOrder: ["Fl", "fl"],
    genotypes: ["FlFl", "Flfl", "flfl"],
    allowBlank: true,
  },
  {
    key: "Sty",
    label: "Sooty (Sty/sty)",
    alleleOrder: ["Sty", "sty"],
    genotypes: ["StySty", "Stysty", "stysty"],
    allowBlank: true,
  },
  {
    key: "Ra",
    label: "Rabicano (Ra/ra)",
    alleleOrder: ["Ra", "ra"],
    genotypes: ["RaRa", "Rara", "rara"],
    allowBlank: true,
  },
];

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element nicht gefunden: ${id}`);
  return el;
}

function normalizeGenotype(genotype, alleleOrder) {
  // genotype: z.B. "eE" -> "Ee", "crCr" -> "Crcr"
  // alleleOrder: ["E","e"] oder ["Cr","cr"]
  const alleles = splitAlleles(genotype, alleleOrder);
  const sorted = alleles.sort((a, b) => alleleOrder.indexOf(a) - alleleOrder.indexOf(b));
  return sorted.join("");
}

function splitAlleles(genotype, alleleOrder) {
  // Unterstützt 1- oder 2-Zeichen-Allele (z.B. "Cr" vs "cr").
  // Wir parsen, indem wir mit den bekannten Allelen matchen.
  const candidates = [...alleleOrder].sort((a, b) => b.length - a.length);
  const alleles = [];
  let rest = genotype;
  while (rest.length > 0) {
    const match = candidates.find((a) => rest.startsWith(a));
    if (!match) {
      throw new Error(`Genotyp konnte nicht geparst werden: "${genotype}" (Rest: "${rest}")`);
    }
    alleles.push(match);
    rest = rest.slice(match.length);
  }
  if (alleles.length !== 2) {
    throw new Error(`Genotyp muss aus 2 Allelen bestehen: "${genotype}"`);
  }
  return alleles;
}

function gametesFromGenotype(genotype, alleleOrder) {
  const [a1, a2] = splitAlleles(genotype, alleleOrder);
  if (a1 === a2) return [{ allele: a1, p: 1 }];
  return [
    { allele: a1, p: 0.5 },
    { allele: a2, p: 0.5 },
  ];
}

function punnett(parent1Genotype, parent2Genotype, alleleOrder) {
  // Leere Auswahl => Locus wird ignoriert
  if (!parent1Genotype || !parent2Genotype) {
    return new Map([["", 1]]);
  }
  const g1 = normalizeGenotype(parent1Genotype, alleleOrder);
  const g2 = normalizeGenotype(parent2Genotype, alleleOrder);
  const gam1 = gametesFromGenotype(g1, alleleOrder);
  const gam2 = gametesFromGenotype(g2, alleleOrder);

  const dist = new Map(); // genotype -> probability
  for (const a of gam1) {
    for (const b of gam2) {
      const child = normalizeGenotype(`${a.allele}${b.allele}`, alleleOrder);
      const p = a.p * b.p;
      dist.set(child, (dist.get(child) ?? 0) + p);
    }
  }
  return dist;
}

function cartesianCombineDistributions(distsByLocus) {
  // Input: [{locusKey, dist: Map(genotype->p)}]
  // Output: Map(signature->p) where signature like "EE|Aa|gg|Crcr|Dd" in locus order
  let acc = new Map([["", 1]]);

  for (const { locusKey, dist } of distsByLocus) {
    const next = new Map();
    for (const [sig, pSig] of acc.entries()) {
      for (const [gt, pGt] of dist.entries()) {
        const newSig = sig ? `${sig}|${gt}` : gt;
        next.set(newSig, (next.get(newSig) ?? 0) + pSig * pGt);
      }
    }
    acc = next;
  }
  return acc;
}

function roundPct(x) {
  return Math.round(x * 1000) / 10; // 0.1%
}

function agoutiCategory(agoutiGenotype) {
  // Rückgabe: "wildbay" | "bay" | "sealbrown" | "black"
  // Dominanz: Ap > A1 > At > a0
  if (agoutiGenotype === "a0a0") return "black";
  if (agoutiGenotype.includes("Ap")) return "wildbay";
  if (agoutiGenotype.includes("A1")) return "bay";
  if (agoutiGenotype.includes("At")) return "sealbrown";
  return "black";
}

function addVisibleModifiers(name, modifiers) {
  if (modifiers.length === 0) return name;
  return `${name} (${modifiers.join(", ")})`;
}

function coreBaseCategory(baseName) {
  if (baseName === "Bay" || baseName === "Wildbay") return "BayOrWildbay";
  return baseName;
}

function classifyCrPrl(CrPrl) {
  if (!CrPrl) return { cream: 0, pearl: 0, pearlCarrier: false, isCrpl: false };
  // Cream/Pearl liegen auf demselben Locus: Cr / cr / pl
  // Cream: Crcr => 1, CrCr => 2, Crpl => 1 (wird später wie 2 benannt), sonst 0
  const cream = CrPrl === "CrCr" ? 2 : CrPrl === "Crcr" || CrPrl === "Crpl" ? 1 : 0;
  const pearl = CrPrl === "plpl" ? 2 : 0;
  const pearlCarrier = CrPrl === "crpl";
  const isCrpl = CrPrl === "Crpl";
  return { cream, pearl, pearlCarrier, isCrpl };
}

function computeColorName({ base, hasDun, hasChampagne, CrPrl }) {
  const baseCat = coreBaseCategory(base);
  const { cream, pearl, pearlCarrier, isCrpl } = classifyCrPrl(CrPrl);

  const chOn = hasChampagne;
  const dOn = hasDun;

  // Pearl (plpl)
  if (pearl === 2) {
    // Offene Kombi laut "~folgt~"
    if (dOn && chOn) return { name: "Unbekannt", pearlCarrier };

    if (dOn) {
      if (base === "Chestnut") return { name: "Apricot Dun", pearlCarrier };
      if (baseCat === "BayOrWildbay") return { name: "Pearl Bay Dun", pearlCarrier };
      if (base === "Black") return { name: "Pearl Black Dun", pearlCarrier };
      if (base === "Sealbrown") return { name: "Pearl Brown Dun", pearlCarrier };
    }
    if (chOn) {
      if (base === "Chestnut") return { name: "Gold Pearl", pearlCarrier };
      // ~folgt~: unknown
      return { name: "Unbekannt", pearlCarrier };
    }

    if (base === "Chestnut") return { name: "Apricot", pearlCarrier };
    if (baseCat === "BayOrWildbay") return { name: "Pearl Bay", pearlCarrier };
    if (base === "Black") return { name: "Pearl Black", pearlCarrier };
    if (base === "Sealbrown") return { name: "Pearl Brown", pearlCarrier };
  }

  // Cream/Pearl Kombi (Crpl) wird wie CrCr benannt
  const creamLike = isCrpl ? 2 : cream;

  // D x Ch (ohne Cream/Pearl)
  if (dOn && chOn && creamLike === 0) {
    if (base === "Chestnut") return { name: "Gold Dun", pearlCarrier };
    if (baseCat === "BayOrWildbay") return { name: "Amber Dun", pearlCarrier };
    if (base === "Black") return { name: "Champagne Dun", pearlCarrier };
    if (base === "Sealbrown") return { name: "Sable Dun", pearlCarrier };
  }

  // D x Cr (Crcr)
  if (dOn && !chOn && creamLike === 1) {
    if (base === "Chestnut") return { name: "Dunalino", pearlCarrier };
    if (base === "Bay") return { name: "Dunskin", pearlCarrier };
    if (base === "Wildbay") return { name: "Wild Dunskin", pearlCarrier };
    if (base === "Black") return { name: "Smoky Grulla", pearlCarrier };
    if (base === "Sealbrown") return { name: "Smoky Brown Dun", pearlCarrier };
  }

  // D x CrCr / Crpl
  if (dOn && !chOn && creamLike === 2) {
    if (base === "Chestnut") return { name: "Cremello Dun", pearlCarrier };
    if (baseCat === "BayOrWildbay") return { name: "Perlino Dun", pearlCarrier };
    if (base === "Black") return { name: "Smoky Cream Dun", pearlCarrier };
    if (base === "Sealbrown") return { name: "Sealbrown Cream Dun", pearlCarrier };
  }

  // Ch x Cr (Crcr)
  if (!dOn && chOn && creamLike === 1) {
    if (base === "Chestnut") return { name: "Gold Cream", pearlCarrier };
    if (baseCat === "BayOrWildbay") return { name: "Amber Cream", pearlCarrier };
    if (base === "Black") return { name: "Classic Cream", pearlCarrier };
    if (base === "Sealbrown") return { name: "Sable Cream", pearlCarrier };
  }

  // Ch x CrCr / Crpl
  if (!dOn && chOn && creamLike === 2) {
    if (base === "Chestnut") return { name: "Cremello Champagne", pearlCarrier };
    if (baseCat === "BayOrWildbay") return { name: "Perlino Champagne", pearlCarrier };
    if (base === "Black") return { name: "Smoky Cream Champagne", pearlCarrier };
    if (base === "Sealbrown") return { name: "Sealbrown Cream Champagne", pearlCarrier };
  }

  // D x Ch x Cr (Crcr)
  if (dOn && chOn && creamLike === 1) {
    if (base === "Chestnut") return { name: "Gold Dun Cream", pearlCarrier };
    if (baseCat === "BayOrWildbay") return { name: "Amber Dun Cream", pearlCarrier };
    if (base === "Black") return { name: "Classic Dun Cream", pearlCarrier };
    if (base === "Sealbrown") return { name: "Sable Dun Cream", pearlCarrier };
  }

  // ~folgt~: D x Ch x CrCr / Crpl
  if (dOn && chOn && creamLike === 2) {
    return { name: "Unbekannt", pearlCarrier };
  }

  // Fallback: Single-Cream
  if (!dOn && !chOn && creamLike === 1) {
    if (base === "Chestnut") return { name: "Palomino", pearlCarrier };
    if (base === "Bay") return { name: "Buckskin", pearlCarrier };
    if (base === "Wildbay") return { name: "Wild Buckskin", pearlCarrier };
    if (base === "Black") return { name: "Smoky Black", pearlCarrier };
    if (base === "Sealbrown") return { name: "Smoky Brown", pearlCarrier };
  }

  // Fallback: Double-Cream / Crpl
  if (!dOn && !chOn && creamLike === 2) {
    if (base === "Chestnut") return { name: "Cremello", pearlCarrier };
    if (baseCat === "BayOrWildbay") return { name: "Perlino", pearlCarrier };
    if (base === "Black") return { name: "Smoky Cream", pearlCarrier };
    if (base === "Sealbrown") return { name: "Sealbrown Cream", pearlCarrier };
  }

  // Fallback: Champagne (ohne Dun/Cream)
  if (!dOn && chOn && creamLike === 0) {
    if (base === "Chestnut") return { name: "Gold Champagne", pearlCarrier };
    if (baseCat === "BayOrWildbay") return { name: "Amber Champagne", pearlCarrier };
    if (base === "Black") return { name: "Classic Champagne", pearlCarrier };
    if (base === "Sealbrown") return { name: "Sable Champagne", pearlCarrier };
  }

  // Fallback: Dun (ohne Champagne/Cream)
  if (dOn && !chOn && creamLike === 0) {
    if (base === "Chestnut") return { name: "Red Dun", pearlCarrier };
    if (baseCat === "BayOrWildbay") return { name: "Classic Dun", pearlCarrier };
    if (base === "Black") return { name: "Grulla", pearlCarrier };
    if (base === "Sealbrown") return { name: "Brown Dun", pearlCarrier };
  }

  return { name: base, pearlCarrier };
}

function kitFlags(kitGenotype) {
  if (!kitGenotype) return { hasTO: false, hasWI: false, hasRn: false, hasSB: false };
  const g = String(kitGenotype);
  const hasTO = g.includes("TO");
  const hasWI = g.includes("WI");
  const hasRn = g.includes("Rn");
  const hasSB = g.includes("SB");
  return { hasTO, hasWI, hasRn, hasSB };
}

function derivePhenotype({ E, A, G, CrPrl, Ch, Z, D, O, SPL, LP, PATN1, KIT, Fl, Sty, Ra }) {
  // Sehr vereinfachte Ableitung, aber konsistent und erweiterbar.
  // 1) Basisfarbe via E/A
  const hasBlackPigment = E !== "ee";
  let base;
  if (!hasBlackPigment) {
    base = "Chestnut";
  } else {
    const aCat = agoutiCategory(A);
    if (aCat === "black") base = "Black";
    else if (aCat === "wildbay") base = "Wildbay";
    else if (aCat === "bay") base = "Bay";
    else base = "Sealbrown";
  }

  // 2) Farbnamen-Logik (D + Ch + Cr/pl)
  const hasDun = !!D && D !== "dd";
  const hasChampagne = !!Ch && Ch !== "chch";
  const { name: baseColorName, pearlCarrier } = computeColorName({ base, hasDun, hasChampagne, CrPrl });

  // 3) KIT Flags
  const k = kitFlags(KIT);
  const hasRoan = k.hasRn;
  const hasTobiano = k.hasTO;
  const hasSabino = k.hasSB;
  const hasDominantWhite = k.hasWI;

  // 4) Silver
  const zCount = Z === "ZZ" ? 2 : Z === "Zz" ? 1 : 0;
  const isSilver = zCount > 0 && hasBlackPigment;
  let silverNote = null;
  const baseName = baseColorName;
  if (zCount > 0) {
    if (hasBlackPigment) {
      silverNote = zCount === 2 ? "Silver (homozygot)" : "Silver";
    } else {
      silverNote = "Silver (ohne Wirkung bei Fuchs)";
    }
  }

  // 5) Präfix/Suffix-Anhänge (Reihenfolge wie gewünscht)
  const prefixes = [];
  const suffixes = [];

  // Präfixe: Flaxen → Silver → Sooty
  if (Fl === "flfl" && base === "Chestnut" && CrPrl === "crcr") prefixes.push("Flaxen");
  if (isSilver) prefixes.push("Silver");
  if (Sty && Sty !== "stysty") prefixes.push("Sooty");

  // Suffixe: Rabicano → Roan → (Scheckungen)
  if (Ra !== "rara") suffixes.push("Rabicano");
  if (hasRoan) suffixes.push("Roan");

  const hasOvero = O !== "oo";
  const hasSplash = SPL !== "splspl";
  const hasLeopard = LP !== "lplp";

  const spotting = {
    overo: hasOvero,
    splash: hasSplash,
    leopard: hasLeopard,
    tobiano: hasTobiano,
    sabino: hasSabino,
  };
  const spottingCount = Object.values(spotting).filter(Boolean).length;

  if (spottingCount >= 2) {
    const onlyTovero = spotting.tobiano && spotting.overo && spottingCount === 2;
    if (onlyTovero) suffixes.push("Tovero");
    else suffixes.push("Pinto");
  } else if (spottingCount === 1) {
    if (spotting.overo) suffixes.push("Overo");
    else if (spotting.splash) suffixes.push("Splashed White");
    else if (spotting.leopard) suffixes.push("Leopard");
    else if (spotting.tobiano) suffixes.push("Tobiano");
    else if (spotting.sabino) suffixes.push("Sabino");
  }

  const withAffixes = `${prefixes.join(" ")}${prefixes.length ? " " : ""}${baseName}${
    suffixes.length ? " " : ""
  }${suffixes.join(" ")}`.trim();

  const withDominantWhite = hasDominantWhite ? `Dominant White (${withAffixes})` : withAffixes;

  // 8) Grey überschreibt (langfristig)
  const isGrey = !!G && G !== "gg";
  const tags = [];
  if (pearlCarrier) tags.push("Pearl Träger (crpl)");
  if (silverNote) tags.push(silverNote);
  if (isGrey) tags.push("Grey");

  // Dominant White ist dominanter als Grey:
  // - wenn WI vorhanden: immer "Dominant White (...)"
  // - sonst wenn Grey vorhanden: "Grey (...)"
  // - sonst normal
  const shown = hasDominantWhite ? withDominantWhite : isGrey ? `Grey (${withAffixes})` : withAffixes;
  const detail = null;
  return { shown, detail, tags };
}

function formatDistributionTable(entries, caption) {
  const rows = entries
    .sort((a, b) => b.p - a.p)
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.label)}</td><td>${roundPct(e.p)}%</td></tr>`
    )
    .join("");
  return `
    <div class="pill">${escapeHtml(caption)}</div>
    <table>
      <thead><tr><th>Ausprägung</th><th>Wahrscheinlichkeit</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeKey(s) {
  return String(s)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parsePercentValue(line) {
  // Accepts "14 %", "14%", "14,5 %", "14.5%"
  const m = String(line).match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  if (!Number.isFinite(v)) return null;
  return v;
}

function parsePercentBlocks(text) {
  // Heuristic parser for copy/paste blocks:
  // whenever a line contains a %, the previous non-empty line becomes the key/label.
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim());

  const items = [];
  let prevNonEmpty = null;
  let prevPrevNonEmpty = null;

  for (const line of lines) {
    if (!line) continue;
    const pct = parsePercentValue(line);
    if (pct != null) {
      const label = prevNonEmpty ?? "(Unbekannt)";
      const group = prevPrevNonEmpty ?? null;
      items.push({ label, key: normalizeKey(label), group, pct });
      continue;
    }
    prevPrevNonEmpty = prevNonEmpty;
    prevNonEmpty = line;
  }

  // keep last occurrence per key (if pasted twice)
  const byKey = new Map();
  for (const it of items) byKey.set(it.key, it);
  return [...byKey.values()];
}

function parseInterieur(text) {
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items = [];
  for (const line of lines) {
    const parts = line.split(/\t+| {2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const trait = parts[0];
    const rating = parts.slice(1).join(" ");
    items.push({ trait, key: normalizeKey(trait), rating });
  }
  // last wins
  const byKey = new Map();
  for (const it of items) byKey.set(it.key, it);
  return [...byKey.values()];
}

function formatTurnierLine(name, value, lk, interieur) {
  // value: integer-ish, lk: 2-digit, interieur: 1 decimal (will be filled later by your rules)
  const vStr = value == null ? "—" : String(value).padStart(3, "0");
  const lkStr = lk == null ? "—" : String(lk);
  const iStr = interieur == null ? "—" : String(interieur);
  return `${name}: ${vStr} / ${lkStr} / ${iStr}`;
}

const TURNIER_RULES = [
  {
    name: "Dressur",
    disciplineKey: "Dressur",
    extras: ["Schritt", "Trab", "Galopp", "Kraft", "Präzision", "Ausdruck"],
    interTraits: ["Gelehrigkeit", "Aufmerksamkeit", "Intelligenz"],
  },
  {
    name: "Springen",
    disciplineKey: "Springen",
    extras: ["Galopp", "Beschleunigung", "Wendigkeit", "Kondition", "Kraft", "Tempo"],
    interTraits: ["Furchtlosigkeit", "Leistungsbereitschaft", "Temperament"],
  },
  {
    name: "Cross Country",
    disciplineKey: "Cross Country",
    extras: ["Galopp", "Beschleunigung", "Wendigkeit", "Kondition", "Kraft", "Tempo"],
    interTraits: ["Nervenstärke", "Aufmerksamkeit", "Leistungsbereitschaft"],
  },
  {
    name: "Distanz",
    disciplineKey: "Distanz",
    extras: ["Schritt", "Trab", "Galopp", "Kondition", "Tempo", "Gelassenheit"],
    interTraits: ["Gutmütigkeit", "Nervenstärke", "Temperament"],
  },

  {
    name: "Flachrennen",
    disciplineKey: "Flachrennen",
    extras: ["Renngalopp", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit"],
    interTraits: ["Siegeswille", "Leistungsbereitschaft", "Temperament"],
  },
  {
    name: "Hindernisrennen",
    disciplineKey: "Hindernisrennen",
    extras: ["Renngalopp", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit"],
    interTraits: ["Siegeswille", "Nervenstärke", "Aufmerksamkeit"],
  },
  {
    name: "Seejagdrennen",
    disciplineKey: "Seejagdrennen",
    extras: ["Renngalopp", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit"],
    interTraits: ["Siegeswille", "Nervenstärke", "Furchtlosigkeit"],
  },
  {
    name: "Trabrennen",
    disciplineKey: "Trabrennen",
    extras: ["Trab", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit"],
    interTraits: ["Temperament", "Siegeswille", "Leistungsbereitschaft"],
  },

  {
    name: "Reining",
    disciplineKey: "Reining",
    extras: ["Schritt", "Galopp", "Beschleunigung", "Wendigkeit", "Kondition", "Präzision"],
    interTraits: ["Temperament", "Leistungsbereitschaft", "Intelligenz"],
  },
  {
    name: "Trail",
    disciplineKey: "Trail",
    extras: ["Schritt", "Trab", "Galopp", "Wendigkeit", "Präzision", "Gelassenheit"],
    interTraits: ["Aufmerksamkeit", "Gelehrigkeit", "Intelligenz"],
  },
  {
    name: "Pleasure",
    disciplineKey: "Pleasure",
    extras: ["Schritt", "Trab", "Galopp", "Gelassenheit", "Ausdruck", "Präzision"],
    interTraits: ["Sozialverhalten", "Gutmütigkeit", "Gelehrigkeit"],
  },
  {
    name: "Horsemanship",
    disciplineKey: "Horsemanship",
    extras: ["Schritt", "Trab", "Galopp", "Gelassenheit", "Ausdruck", "Präzision"],
    interTraits: ["Gutmütigkeit", "Gelehrigkeit", "Intelligenz"],
  },

  {
    name: "Cutting",
    disciplineKey: "Cutting",
    extras: ["Galopp", "Beschleunigung", "Wendigkeit", "Gelassenheit", "Kraft", "Tempo"],
    interTraits: ["Furchtlosigkeit", "Nervenstärke", "Intelligenz"],
  },
  {
    name: "Roping",
    disciplineKey: "Roping",
    extras: ["Galopp", "Beschleunigung", "Präzision", "Gelassenheit", "Kraft", "Tempo"],
    interTraits: ["Aufmerksamkeit", "Furchtlosigkeit", "Nervenstärke"],
  },
  {
    name: "Pole Bending",
    disciplineKey: "Pole Bending",
    extras: ["Galopp", "Beschleunigung", "Wendigkeit", "Präzision", "Kraft", "Tempo"],
    interTraits: ["Leistungsbereitschaft", "Siegeswille", "Temperament"],
  },
  {
    name: "Barrel Racing",
    disciplineKey: "Barrel Racing",
    extras: ["Galopp", "Beschleunigung", "Wendigkeit", "Präzision", "Kraft", "Tempo"],
    interTraits: ["Leistungsbereitschaft", "Siegeswille", "Temperament"],
  },

  {
    name: "Dressurfahren",
    disciplineKey: "Dressurfahren",
    extras: ["Schritt", "Trab", "Galopp", "Wendigkeit", "Präzision", "Ausdruck"],
    interTraits: ["Sozialverhalten", "Gelehrigkeit", "Intelligenz"],
  },
  {
    name: "Hindernisfahren",
    disciplineKey: "Hindernisfahren",
    extras: ["Galopp", "Tempo", "Wendigkeit", "Präzision", "Kondition", "Kraft"],
    interTraits: ["Sozialverhalten", "Aufmerksamkeit", "Furchtlosigkeit"],
  },
  {
    name: "Geländefahren",
    disciplineKey: "Geländefahren",
    extras: ["Galopp", "Tempo", "Wendigkeit", "Gelassenheit", "Kondition", "Kraft"],
    interTraits: ["Sozialverhalten", "Nervenstärke", "Furchtlosigkeit"],
  },
  {
    name: "Holzrücken",
    disciplineKey: "Holzrücken",
    extras: ["Schritt", "Kraft", "Gelassenheit", "Kondition", "Wendigkeit", "Ausdruck"],
    interTraits: ["Nervenstärke", "Furchtlosigkeit", "Gutmütigkeit"],
  },

  {
    name: "Klassische Dressur",
    disciplineKey: "Klassische Dressur",
    extras: ["Schritt", "Trab", "Galopp", "Kraft", "Präzision", "Ausdruck"],
    interTraits: ["Gelehrigkeit", "Aufmerksamkeit", "Intelligenz"],
  },
  {
    name: "Spanische Gänge",
    disciplineKey: "Spanische Gänge",
    extras: ["Schritt", "Trab", "Wendigkeit", "Präzision", "Ausdruck", "Gelassenheit"],
    interTraits: ["Gutmütigkeit", "Aufmerksamkeit", "Intelligenz"],
  },
  {
    name: "Schulsprünge",
    disciplineKey: "Schulsprünge",
    extras: ["Kraft", "Präzision", "Ausdruck", "Gelassenheit", "Kondition", "Wendigkeit"],
    interTraits: ["Temperament", "Leistungsbereitschaft", "Nervenstärke"],
  },
  {
    name: "Hohe Schule",
    disciplineKey: "Hohe Schule",
    extras: ["Schritt", "Trab", "Galopp", "Kraft", "Präzision", "Ausdruck"],
    interTraits: ["Gelehrigkeit", "Leistungsbereitschaft", "Intelligenz"],
  },

  {
    name: "Tölt-Prüfung",
    disciplineKey: "Tölt-Prüfung",
    extras: ["Tölt", "Kraft", "Präzision", "Ausdruck", "Kondition", "Gelassenheit"],
    interTraits: ["Gutmütigkeit", "Sozialverhalten", "Aufmerksamkeit"],
  },
  {
    name: "Passrennen",
    disciplineKey: "Passrennen",
    extras: ["Pass", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit"],
    interTraits: ["Sozialverhalten", "Siegeswille", "Temperament"],
  },
  {
    name: "Foxtrott Pleasure",
    disciplineKey: "Foxtrott Pleasure",
    extras: ["Foxtrott", "Gelassenheit", "Ausdruck", "Präzision", "Kondition", "Wendigkeit"],
    interTraits: ["Gutmütigkeit", "Sozialverhalten", "Gelehrigkeit"],
  },
  {
    name: "Racking",
    disciplineKey: "Racking",
    extras: ["Rack", "Tempo", "Ausdruck", "Präzision", "Kondition", "Beschleunigung"],
    interTraits: ["Gutmütigkeit", "Sozialverhalten", "Gelehrigkeit"],
  },
];

const TURNIER_ABBR = new Map([
  ["dressur", "DR"],
  ["springen", "SP"],
  ["cross country", "CC"],
  ["distanz", "DI"],

  ["flachrennen", "FR"],
  ["hindernisrennen", "HR"],
  ["seejagdrennen", "SJR"],
  ["trabrennen", "TR"],

  ["reining", "RE"],
  ["trail", "TL"],
  ["pleasure", "PL"],
  ["horsemanship", "HM"],

  ["cutting", "CU"],
  ["roping", "RO"],
  ["pole bending", "PB"],
  ["barrel racing", "BR"],

  ["dressurfahren", "DF"],
  ["hindernisfahren", "HF"],
  ["geländefahren", "GF"],
  ["holzrücken", "HO"],

  ["klassische dressur", "KD"],
  ["spanische gänge", "SG"],
  ["schulsprünge", "SS"],
  ["hohe schule", "HS"],

  ["tölt-prüfung", "TP"],
  ["passrennen", "PR"],
  ["foxtrott pleasure", "FP"],
  ["racking", "RA"],
]);

function abbrForDisciplineName(name) {
  return TURNIER_ABBR.get(normalizeKey(name)) ?? "??";
}

function formatKurzfassungLine(abbr, value, lkStr, interStr) {
  // Required format with double spaces:
  // "AB  Wert  LK  Interieur"
  const v = value == null ? "—" : String(value).padStart(3, "0");
  const lk = lkStr ? String(lkStr).replace(/^LK/i, "") : "—";
  const inter = interStr ?? "—";
  return `${abbr}  ${v}  ${lk}  ${inter}`;
}

function parseOneDecimalCommaToNumber(s) {
  if (s == null) return null;
  const x = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

function lkNumberFromLkStr(lkStr) {
  if (!lkStr) return null;
  const m = String(lkStr).match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function applyKurzfassungFilter(rows, options) {
  const mode = options?.mode ?? "default";

  const rules =
    mode === "more"
      ? {
          maxInterieur: 3.0,
          minByLk: new Map([
            [10, 120],
            [9, 180],
            [8, 210],
          ]),
        }
      : {
          maxInterieur: 2.7,
          minByLk: new Map([
            [10, 130],
            [9, 190],
            [8, 220],
          ]),
        };

  return rows.filter((row) => {
    if (row.value == null || row.lkStr == null || row.interStr == null) return false;

    const inter = parseOneDecimalCommaToNumber(row.interStr);
    if (inter == null) return false;
    if (inter > rules.maxInterieur) return false;

    const lk = lkNumberFromLkStr(row.lkStr);
    if (lk == null) return false;
    const min = rules.minByLk.get(lk);
    if (min != null && row.value < min) return false;

    return true;
  });
}

function indexPctItems(items) {
  const map = new Map();
  for (const it of items) map.set(it.key, it);
  return map;
}

function leistungsklasseFromMinPct(minPct) {
  // LK10: 0-9, LK9: 10-19, ..., LK1: 90-100
  const x = Math.max(0, Math.min(100, Number(minPct)));
  if (!Number.isFinite(x)) return null;
  if (x >= 90) return 1;
  const bucket = Math.floor(x / 10); // 0..8
  return 10 - bucket;
}

function interieurScoreFromItems(traitNames, interByKey) {
  const missing = [];
  const scores = traitNames.map((t) => {
    const it = interByKey.get(normalizeKey(t));
    if (!it) {
      missing.push(t);
      return null;
    }
    const score = interieurRatingToScore(it.rating);
    if (score == null) missing.push(`${t} (${it.rating})`);
    return score;
  });
  if (missing.length > 0) return { value: null, missing };
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { value: avg, missing: [] };
}

function interieurRatingToScore(rating) {
  const r = normalizeKey(rating);
  if (r === "exzellent") return 1;
  if (r === "gut") return 2;
  if (r === "in ordnung") return 3;
  if (r === "schlecht") return 4;
  if (r === "miserabel") return 5;
  return null;
}

function formatOneDecimalComma(x) {
  if (!Number.isFinite(x)) return null;
  return x.toFixed(1).replace(".", ",");
}

function calcTurnierWertForRule(rule, discsByKey, basicsByKey, interByKey) {
  const missing = [];

  const discItem = discsByKey.get(normalizeKey(rule.disciplineKey));
  if (!discItem) missing.push(rule.disciplineKey);

  const extrasItems = rule.extras.map((k) => {
    const it = basicsByKey.get(normalizeKey(k));
    if (!it) missing.push(k);
    return it;
  });

  if (missing.length > 0) return { value: null, missing };

  const valueRaw = discItem.pct * 3 + extrasItems.reduce((acc, it) => acc + (it?.pct ?? 0), 0);
  // Ausgabe: ganzzahlig (spiel-tauglich), später anpassbar
  const value = Math.round(valueRaw);

  const consideredPcts = [discItem.pct, ...extrasItems.map((it) => it.pct)];
  const minPct = Math.min(...consideredPcts);
  const lk = leistungsklasseFromMinPct(minPct);

  const interTraits = rule.interTraits ?? [];
  const inter = interTraits.length ? interieurScoreFromItems(interTraits, interByKey) : { value: null, missing: [] };
  if (inter.missing.length > 0) {
    // annotate missing interieur but still return computed value/lk
    for (const m of inter.missing) missing.push(`Interieur: ${m}`);
  }

  return { value, lk, interieur: inter.value, missing };
}

function readParents() {
  const p1 = {};
  const p2 = {};

  for (const locus of LOCI) {
    p1[locus.key] = $(makeSelectId(1, locus.key)).value;
    p2[locus.key] = $(makeSelectId(2, locus.key)).value;
  }
  return { p1, p2 };
}

function makeSelectId(parentIdx, locusKey) {
  return `p${parentIdx}_${locusKey}`;
}

function render() {
  const { p1, p2 } = readParents();
  const distsByLocus = LOCI.map((locus) => ({
    locusKey: locus.key,
    dist: punnett(p1[locus.key], p2[locus.key], locus.alleleOrder),
  }));

  const combined = cartesianCombineDistributions(distsByLocus);
  const locusKeys = LOCI.map((l) => l.key);

  // Phänotypen zusammenfassen
  const phenoDist = new Map(); // shown -> p
  const detailDist = new Map(); // detail string -> p (optional)

  for (const [sig, p] of combined.entries()) {
    const parts = sig.split("|");
    const g = {};
    for (let i = 0; i < locusKeys.length; i++) g[locusKeys[i]] = parts[i];

    const ph = derivePhenotype(g);
    phenoDist.set(ph.shown, (phenoDist.get(ph.shown) ?? 0) + p);
    if (ph.detail) detailDist.set(ph.detail, (detailDist.get(ph.detail) ?? 0) + p);
  }

  // Einzel-Locus Tabellen
  const locusTables = distsByLocus
    .map(({ locusKey, dist }) => {
      const locus = LOCI.find((l) => l.key === locusKey);
      const entries = [...dist.entries()].map(([gt, p]) => ({ label: gt, p }));
      return formatDistributionTable(entries, `${locusKey}: ${locus?.label ?? locusKey}`);
    })
    .join("");

  const phenoEntries = [...phenoDist.entries()].map(([label, p]) => ({ label, p }));
  const phenoTable = formatDistributionTable(phenoEntries, "Phänotyp (vereinfacht)");

  // Warnungen (z.B. Letalität)
  const overoDist = distsByLocus.find((x) => x.locusKey === "O")?.dist;
  const lethalOO = overoDist ? (overoDist.get("OO") ?? 0) : 0;
  const warnings = [];
  if (lethalOO > 0) {
    warnings.push(
      `<div class="warn"><b>Warnung:</b> Erwartete Wahrscheinlichkeit für <b>OO</b> (Overo homozygot) ist ${roundPct(
        lethalOO
      )}% und gilt als letal.</div>`
    );
  }

  const details = [...detailDist.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([d, p]) => `<li>${escapeHtml(d)}: ${roundPct(p)}%</li>`)
    .join("");

  const detailsBlock =
    details.length > 0
      ? `<div class="muted" style="margin-top:10px">Hinweis (nur bei Grey):</div><ul>${details}</ul>`
      : "";

  $("result").classList.remove("muted");
  $("result").innerHTML = `
    ${phenoTable}
    ${warnings.length ? `<div style="margin-top:10px">${warnings.join("")}</div>` : ""}
    ${detailsBlock}
    <div style="height:12px"></div>
    <div class="pill">Genotyp-Verteilungen je Locus</div>
    ${locusTables}
  `;
}

function resetToDefaults() {
  // sinnvolle Defaultwerte: heterozygot bei Dominanzloci, damit man direkt Variation sieht
  const defaults = {
    E: "ee",
    A: "a0a0",
    D: "dd",
    CrPrl: "crcr",
    Ch: "chch",
    G: "gg",
    Z: "zz",
    O: "oo",
    SPL: "splspl",
    LP: "lplp",
    PATN1: "P1P1",
    KIT: "00",
    Fl: "FlFl",
    Sty: "stysty",
    Ra: "rara",
  };

  function setSelectValueSafe(parentIdx, locusKey, value) {
    const sel = $(makeSelectId(parentIdx, locusKey));
    const exists = [...sel.options].some((o) => o.value === value);
    sel.value = exists ? value : sel.options[0]?.value ?? "";
  }

  for (const locus of LOCI) {
    const v = defaults[locus.key] ?? locus.genotypes[0];
    setSelectValueSafe(1, locus.key, v);
    setSelectValueSafe(2, locus.key, v);
  }
  $("result").classList.add("muted");
  $("result").textContent = "Wähle die Genotypen und klicke auf „Berechnen“.";
}

function init() {
  for (const locus of LOCI) {
    for (const parentIdx of [1, 2]) {
      const sel = $(makeSelectId(parentIdx, locus.key));
      const blank = locus.allowBlank ? `<option value="">—</option>` : "";
      sel.innerHTML =
        blank +
        locus.genotypes
          .map((gt) => `<option value="${gt}">${gt === "" ? "—" : gt}</option>`)
          .join("");
    }
  }

  $("calcBtn").addEventListener("click", render);
  $("resetBtn").addEventListener("click", resetToDefaults);

  // Simple "pages" (Tabs) via show/hide
  function showPage(pageKey) {
    const isColor = pageKey !== "calc2";

    const pageColor = document.getElementById("page-color");
    const pageCalc2 = document.getElementById("page-calc2");
    const tabColor = document.getElementById("tab-color");
    const tabCalc2 = document.getElementById("tab-calc2");

    if (pageColor) pageColor.classList.toggle("hidden", !isColor);
    if (pageCalc2) pageCalc2.classList.toggle("hidden", isColor);

    if (tabColor) tabColor.classList.toggle("active", isColor);
    if (tabCalc2) tabCalc2.classList.toggle("active", !isColor);

    // optional deep-link
    const hash = isColor ? "#color" : "#calc2";
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }

  function initTabs() {
    const tabs = document.querySelectorAll(".tab[data-page]");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => showPage(btn.dataset.page));
    });

    // default from hash
    showPage(location.hash === "#calc2" ? "calc2" : "color");
  }

  // Placeholder calculator 2 wiring
  const calc2Btn = document.getElementById("calc2Btn");
  const calc2ResetBtn = document.getElementById("calc2ResetBtn");
  const calc2Result = document.getElementById("calc2Result");
  const calc2Summary = document.getElementById("calc2Summary");
  const calc2Disciplines = document.getElementById("calc2Disciplines");
  const calc2Basics = document.getElementById("calc2Basics");
  const calc2Interieur = document.getElementById("calc2Interieur");

  function calc2Reset() {
    if (!calc2Result) return;
    if (calc2Disciplines) calc2Disciplines.value = "";
    if (calc2Basics) calc2Basics.value = "";
    if (calc2Interieur) calc2Interieur.value = "";
    calc2Result.classList.add("muted");
    calc2Result.textContent = "Noch keine Berechnung hinterlegt.";
    if (calc2Summary) {
      calc2Summary.classList.add("muted");
      calc2Summary.innerHTML = `
        <div class="summaryHeader">
          <span class="pill">Kurzfassung</span>
          <label class="check">
            <input id="calc2More" type="checkbox" />
            mehr anzeigen
          </label>
        </div>
        <p class="summaryPlaceholder">Nach „Berechnen“ erscheint hier die Kurzfassung zum Kopieren.</p>
      `;
    }
  }
  function calc2Render() {
    if (!calc2Result) return;
    const discs = parsePercentBlocks(calc2Disciplines?.value ?? "");
    const basics = parsePercentBlocks(calc2Basics?.value ?? "");
    const inter = parseInterieur(calc2Interieur?.value ?? "");

    // The actual rules (which values count into Value/LK/Interieur) will be added next step.
    // For now we only prove that paste->parse works and show the requested output shape.
    const discsByKey = indexPctItems(discs);
    const basicsByKey = indexPctItems(basics);
    const interByKey = new Map(inter.map((x) => [x.key, x]));

    const missingSet = new Map(); // key -> Set(missingName)
    const computed = TURNIER_RULES.map((rule) => {
      // sanity check: always 1 discipline + 6 extras
      if (rule.extras.length !== 6 || (rule.interTraits?.length ?? 0) !== 3) {
        return { rule, value: null, lkStr: null, interStr: null, missing: ["Konfigurationsfehler"] };
      }
      const r = calcTurnierWertForRule(rule, discsByKey, basicsByKey, interByKey);
      const lkStr = r.lk ? `LK${r.lk}` : null;
      const interStr = r.interieur == null ? null : formatOneDecimalComma(r.interieur);
      return { rule, value: r.value, lkStr, interStr, missing: r.missing };
    });

    for (const row of computed) {
      if (row.missing.length > 0) missingSet.set(row.rule.name, new Set(row.missing));
    }

    // Sortierung nach "Wert" absteigend. Fehlende Werte kommen nach unten.
    computed.sort((a, b) => {
      const av = a.value == null ? -Infinity : a.value;
      const bv = b.value == null ? -Infinity : b.value;
      if (bv !== av) return bv - av;
      return a.rule.name.localeCompare(b.rule.name, "de");
    });

    const lines = computed.map((row) => formatTurnierLine(row.rule.name, row.value, row.lkStr, row.interStr));

    const missingLines = [...missingSet.entries()]
      .map(([discName, set]) => `- ${discName}: fehlt ${[...set].join(", ")}`)
      .join("\n");

    calc2Result.classList.remove("muted");
    calc2Result.innerHTML = `
      <div class="pill">Turnierwerte</div>
      <pre style="white-space:pre-wrap;margin:10px 0 0 0">${escapeHtml(lines.join("\n") || "Keine Disziplinen erkannt.")}</pre>
      ${
        missingLines
          ? `<details style="margin-top:10px"><summary class="muted">Fehlende/unerkannt Werte anzeigen</summary><pre style="white-space:pre-wrap;margin:10px 0 0 0">${escapeHtml(
              missingLines
            )}</pre></details>`
          : ""
      }
    `;

    if (calc2Summary) {
      const moreChecked = document.getElementById("calc2More")?.checked ?? false;
      const filtered = applyKurzfassungFilter(computed, { mode: moreChecked ? "more" : "default" });
      const summaryLines = filtered
        .map((row) =>
          formatKurzfassungLine(
            abbrForDisciplineName(row.rule.name),
            row.value,
            row.lkStr,
            row.interStr
          )
        )
        .join("\n");

      calc2Summary.classList.remove("muted");
      calc2Summary.innerHTML = `
        <div class="summaryHeader">
          <span class="pill">Kurzfassung</span>
          <label class="check">
            <input id="calc2More" type="checkbox" ${moreChecked ? "checked" : ""} />
            mehr anzeigen
          </label>
        </div>
        <pre style="white-space:pre-wrap;margin:0">${escapeHtml(summaryLines || "—")}</pre>
      `;
    }
  }

  if (calc2Btn) calc2Btn.addEventListener("click", calc2Render);
  if (calc2ResetBtn) calc2ResetBtn.addEventListener("click", calc2Reset);
  calc2Summary?.addEventListener("change", (e) => {
    if (e.target instanceof HTMLInputElement && e.target.id === "calc2More") calc2Render();
  });

  initTabs();
  calc2Reset();

  resetToDefaults();
}

document.addEventListener("DOMContentLoaded", init);

