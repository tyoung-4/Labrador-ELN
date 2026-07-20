import { validatePointMutation } from "@/utils/aminoAcids";

export const ANNOTATION_TYPES = [
  "POINT_MUTATION", "DISULFIDE", "GLYCOSYLATION", "DOMAIN_SWAP", "TAG",
] as const;

// Server-side validation for annotation POST/PATCH. Enforces the per-type rules
// from the Antibody Designer spec (amino-acid canonicality incl. non-canonical
// "X" handling, disulfide pairing, glyco action, domain-swap/tag requirements).
export function validateAnnotationInput(b: unknown): { valid: boolean; error?: string } {
  if (!b || typeof b !== "object") return { valid: false, error: "Invalid body" };
  const a = b as Record<string, unknown>;

  const type = a.type;
  if (typeof type !== "string" || !ANNOTATION_TYPES.includes(type as never)) {
    return { valid: false, error: `type must be one of ${ANNOTATION_TYPES.join(", ")}` };
  }
  if (typeof a.chain !== "string" || !a.chain.trim()) return { valid: false, error: "chain is required" };
  if (typeof a.region !== "string" || !a.region.trim()) return { valid: false, error: "region is required" };

  const posInt = (v: unknown) => Number.isInteger(Number(v)) && Number(v) > 0;

  switch (type) {
    case "POINT_MUTATION": {
      const v = validatePointMutation({
        wtResidue: String(a.wtResidue ?? ""),
        mutResidue: String(a.mutResidue ?? ""),
        position: Number(a.position),
        isNonCanonical: Boolean(a.isNonCanonical),
        ncaaIdentity: typeof a.ncaaIdentity === "string" ? a.ncaaIdentity : undefined,
      });
      if (!v.valid) return v;
      break;
    }
    case "DISULFIDE":
      if (!posInt(a.position) || !posInt(a.position2)) {
        return { valid: false, error: "Disulfide requires positive integer position and position2" };
      }
      break;
    case "GLYCOSYLATION":
      if (a.glycoAction !== "ADD" && a.glycoAction !== "REMOVE") {
        return { valid: false, error: 'glycoAction must be "ADD" or "REMOVE"' };
      }
      if (!posInt(a.position)) return { valid: false, error: "Glycosylation requires a positive integer position" };
      break;
    case "DOMAIN_SWAP":
      if (typeof a.swapSource !== "string" || !a.swapSource.trim()) {
        return { valid: false, error: "Domain swap requires swapSource" };
      }
      break;
    case "TAG":
      if (typeof a.tagIdentity !== "string" || !a.tagIdentity.trim()) {
        return { valid: false, error: "Tag requires tagIdentity" };
      }
      if (a.region !== "N_TERM" && a.region !== "C_TERM") {
        return { valid: false, error: "Tag region must be N_TERM or C_TERM" };
      }
      break;
  }
  return { valid: true };
}

// Normalize a validated annotation body into Prisma-ready field values.
export function buildAnnotationData(b: Record<string, unknown>, createdBy: string) {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    type: String(b.type),
    chain: String(b.chain),
    region: String(b.region),
    position: num(b.position),
    wtResidue: typeof b.wtResidue === "string" && b.wtResidue ? b.wtResidue.toUpperCase() : null,
    mutResidue: typeof b.mutResidue === "string" && b.mutResidue ? b.mutResidue.toUpperCase() : null,
    isNonCanonical: Boolean(b.isNonCanonical),
    ncaaIdentity: str(b.ncaaIdentity),
    numberingScheme: str(b.numberingScheme) ?? "EU",
    position2: num(b.position2),
    chain2: str(b.chain2),
    region2: str(b.region2),
    glycoAction: str(b.glycoAction),
    swapSource: str(b.swapSource),
    tagIdentity: str(b.tagIdentity),
    rationale: str(b.rationale),
    createdBy,
  };
}
