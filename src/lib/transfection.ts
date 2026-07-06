// ExpiCHO transfection calculator — Day 0 DNA / OptiPRO / ExpiFectamine math.
//
// Unit convention (see the "ng/µL vs µg/mL" clarification):
//   • final DNA concentration in culture is entered in µg/mL,
//   • plasmid stock concentration (NanoDrop) is entered in ng/µL,
//   • and 1 µg/mL === 1 ng/µL, so amount(µg) → volume(µL) = amount*1000/stock.
//
// All volumes below are in µL, amounts in µg, culture volume in mL. The engine
// is pure (no imports) so it can be unit-tested and reused anywhere.

export interface PlasmidRow {
  /** display name / id — for output only */
  name: string;
  /** NanoDrop stock concentration, ng/µL */
  stockConcNgUl: number;
  /** relative ratio (integer or decimal). 0 excludes the plasmid. */
  ratio: number;
}

export interface TransfectionInput {
  cultureVolumeMl: number;
  /** final DNA concentration in culture, µg/mL (protocol range 0.5–1.0, default 0.8) */
  finalConcUgMl: number;
  plasmids: PlasmidRow[];
}

export interface PlasmidResult {
  name: string;
  stockConcNgUl: number;
  ratio: number;
  fraction: number;
  amountUg: number;
  volumeUl: number;
}

export interface TransfectionResult {
  totalDnaUg: number;
  totalDnaVolumeUl: number;
  /** total volume of each prep tube = 4% of culture volume, in µL */
  tubeVolumeUl: number;
  /** cold OptiPRO to add to the DNA tube = tube − total DNA volume */
  optiproForDnaUl: number;
  /** ExpiFectamine CHO volume = 0.32% v/v of culture volume */
  expifectamineUl: number;
  /** cold OptiPRO to add to the ExpiFectamine tube = tube − ExpiFectamine volume */
  optiproForExpifectamineUl: number;
  plasmids: PlasmidResult[];
  warnings: string[];
  errors: string[];
}

const TUBE_FRACTION = 0.04; // OptiPRO+DNA (and OptiPRO+ExpiFectamine) tube = 4% of culture
const EXPIFECTAMINE_FRACTION = 0.0032; // 0.32% v/v of culture volume
const HIGH_DNA_TUBE_FRACTION = 0.1; // warn if DNA volume exceeds 10% of the tube

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// ─── Day 1 / Day 5 / harvest schedule ────────────────────────────────────────
export type ProtocolType = "STANDARD" | "HIGH_TITER" | "MAX_TITER";

const ENHANCER_FRACTION = 0.006; // 0.6% v/v = 6 µL/mL  (150 µL per 25 mL)
const FEED_FRACTION = 0.24;      // 24% v/v = 6 mL per 25 mL
const HARVEST_WINDOWS: Record<ProtocolType, [number, number]> = {
  STANDARD: [7, 10],
  HIGH_TITER: [10, 12],
  MAX_TITER: [12, 14],
};

export interface ExpressionSchedule {
  enhancerUl: number;         // Day 1
  feedMl: number;             // Day 1
  tempShiftC: number | null;  // Day 1: 32 for High/Max Titer, null (stay 37) for Standard
  feed2Ml: number | null;     // Day 5: Max Titer only
  harvestDayStart: number;
  harvestDayEnd: number;
}

export function calculateExpressionSchedule(cultureVolumeMl: number, protocolType: ProtocolType): ExpressionSchedule {
  const v = Number(cultureVolumeMl) || 0;
  const [hs, he] = HARVEST_WINDOWS[protocolType] ?? HARVEST_WINDOWS.STANDARD;
  return {
    enhancerUl: round(ENHANCER_FRACTION * v * 1000, 1),
    feedMl: round(FEED_FRACTION * v, 2),
    tempShiftC: protocolType === "STANDARD" ? null : 32,
    feed2Ml: protocolType === "MAX_TITER" ? round(FEED_FRACTION * v, 2) : null,
    harvestDayStart: hs,
    harvestDayEnd: he,
  };
}

export interface DilutionResult {
  /** volume the culture becomes when diluted to the target density */
  finalVolumeMl: number;
  /** fresh media to add = finalVolume − startingVolume */
  mediaToAddMl: number;
  note?: string;
}

/**
 * Media needed to dilute a culture to the transfection target density (default
 * 6×10⁶ cells/mL). Cells are conserved: measured×starting = target×final, so
 * final = measured×starting/target. The user still enters the ACTUAL volume they
 * transfect (they may cap it at 50/100/… mL) — that value drives the DNA math.
 */
export function calculateDilutionToDensity(
  measuredDensityE6: number,
  startingVolumeMl: number,
  targetDensityE6 = 6,
): DilutionResult {
  const d = Number(measuredDensityE6) || 0;
  const v = Number(startingVolumeMl) || 0;
  const t = Number(targetDensityE6) || 6;
  if (d <= 0 || v <= 0 || t <= 0) return { finalVolumeMl: 0, mediaToAddMl: 0 };
  const finalVolumeMl = round((d * v) / t, 1);
  const mediaToAddMl = round(finalVolumeMl - v, 1);
  const note = d <= t
    ? `Measured density (${d}×10⁶) is at/below the ${t}×10⁶ target — no dilution needed.`
    : undefined;
  return { finalVolumeMl, mediaToAddMl: Math.max(0, mediaToAddMl), note };
}

export function calculateTransfection(input: TransfectionInput): TransfectionResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cultureVolumeMl = Number(input.cultureVolumeMl) || 0;
  const finalConcUgMl = Number(input.finalConcUgMl) || 0;

  if (cultureVolumeMl <= 0) errors.push("Culture volume must be greater than 0.");
  if (finalConcUgMl <= 0) errors.push("Final DNA concentration must be greater than 0.");

  // Only plasmids with a positive ratio participate (ratio 0 = removed).
  const active = input.plasmids.filter((p) => Number(p.ratio) > 0);
  if (active.length === 0) errors.push("Add at least one plasmid with a ratio greater than 0.");
  for (const p of active) {
    if (!(Number(p.stockConcNgUl) > 0)) {
      errors.push(`Stock concentration for "${p.name || "plasmid"}" must be greater than 0.`);
    }
  }

  const totalDnaUg = round(finalConcUgMl * cultureVolumeMl, 2);
  const ratioSum = active.reduce((s, p) => s + Number(p.ratio), 0);

  const plasmids: PlasmidResult[] = active.map((p) => {
    const fraction = ratioSum > 0 ? Number(p.ratio) / ratioSum : 0;
    const amountUg = totalDnaUg * fraction;
    const stock = Number(p.stockConcNgUl) || 0;
    const volumeUl = stock > 0 ? (amountUg * 1000) / stock : 0;
    return {
      name: p.name,
      stockConcNgUl: stock,
      ratio: Number(p.ratio),
      fraction,
      amountUg: round(amountUg, 2),
      volumeUl: round(volumeUl, 1),
    };
  });

  const totalDnaVolumeUl = round(plasmids.reduce((s, p) => s + p.volumeUl, 0), 1);
  const tubeVolumeUl = round(TUBE_FRACTION * cultureVolumeMl * 1000, 1);
  const expifectamineUl = round(EXPIFECTAMINE_FRACTION * cultureVolumeMl * 1000, 1);

  const optiproForDnaRaw = tubeVolumeUl - totalDnaVolumeUl;
  const optiproForExpifectamineUl = round(tubeVolumeUl - expifectamineUl, 1);

  // Edge cases
  if (errors.length === 0) {
    if (optiproForDnaRaw < 0) {
      errors.push(
        `Total DNA volume (${totalDnaVolumeUl.toLocaleString()} µL) exceeds the OptiPRO tube ` +
          `(${tubeVolumeUl.toLocaleString()} µL). Concentrate your DNA stock or reduce the target.`
      );
    } else if (totalDnaVolumeUl > HIGH_DNA_TUBE_FRACTION * tubeVolumeUl) {
      warnings.push(
        `DNA volume is high (${totalDnaVolumeUl.toLocaleString()} µL, ` +
          `>${HIGH_DNA_TUBE_FRACTION * 100}% of the tube). Consider concentrating your stock for better complexation.`
      );
    }
  }

  return {
    totalDnaUg,
    totalDnaVolumeUl,
    tubeVolumeUl,
    optiproForDnaUl: round(Math.max(0, optiproForDnaRaw), 1),
    expifectamineUl,
    optiproForExpifectamineUl,
    plasmids,
    warnings,
    errors,
  };
}
