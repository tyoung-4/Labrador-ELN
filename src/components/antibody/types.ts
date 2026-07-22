// Shared antibody annotation shape (superset of the schematic's lighter type).
// Structurally assignable to SchematicAnnotation, so the same array feeds both
// the schematic and the annotation panel / region boxes.

export type AntibodyAnnotation = {
  id: string;
  type: string;
  chain: string;
  region: string;
  position?: number | null;
  wtResidue?: string | null;
  mutResidue?: string | null;
  isNonCanonical?: boolean;
  ncaaIdentity?: string | null;
  numberingScheme?: string | null;
  position2?: number | null;
  chain2?: string | null;
  region2?: string | null;
  glycoAction?: string | null;
  swapSource?: string | null;
  tagIdentity?: string | null;
  rationale?: string | null;
  createdBy?: string;
};
