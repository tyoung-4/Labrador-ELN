import type { TypedData } from "@/lib/entryTypes";

export type { TypedData };

// ─── Attachment record (mirrors DB Attachment model) ─────────────────────────

export type AttachmentRecord = {
  id: string;
  entryId: string;
  filename: string;
  mime: string;
  size: number;
  path: string;
  createdAt: string;
};

// ─── LinkedRun summary (returned with Entry when linked) ─────────────────────

export type LinkedRun = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

// ─── Entry ────────────────────────────────────────────────────────────────────

export type Entry = {
  id: string;
  title: string;
  description: string;
  technique?: string;
  /** Enum value: GENERAL | EXPERIMENT | PROTOCOL | NOTE | CELL_LINE | PROTEIN | REAGENT | CHROMATOGRAPHY_RUN */
  entryType?: string;
  /** Structured + custom fields stored as JSON in the DB */
  typedData?: TypedData | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  attachments?: AttachmentRecord[];
  authorId?: string;
  author?: {
    id: string;
    name: string | null;
    role: string;
  } | null;
  version?: number;
  /** Nullable FK to ProtocolRun — set when this entry is linked to a run */
  linkedRunId?: string | null;
  linkedRun?: LinkedRun | null;
};

export const TECHNIQUE_OPTIONS = [
  "General",
  "Cloning",
  "Flow Cytometry",
  "Purification",
  "Bacterial Expression",
  "Mammalian Expression",
  "Other",
] as const;

// ─── Protocol-specific technique catalogue (17+ options) ──────────────────────
export const PROTOCOL_TECHNIQUES = [
  "General",
  "Cloning & Assembly",
  "PCR / Amplification",
  "Sequencing",
  "Cell Culture",
  "Transfection",
  "Bacterial Expression",
  "Mammalian Expression",
  "Viral Transduction",
  "Protein Purification",
  "Chromatography",
  "Flow Cytometry",
  "Microscopy & Imaging",
  "Western Blot / SDS-PAGE",
  "ELISA",
  "Mass Spectrometry",
  "Enzyme Kinetics",
  "Binding Assay",
  "Sample Prep & QC",
  "Animal Work",
  "Other",
] as const;

export type ProtocolTechnique = (typeof PROTOCOL_TECHNIQUES)[number];

export function newEntry(data: Partial<Entry> = {}): Entry {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: data.title ?? "Untitled",
    description: data.description ?? "",
    technique: data.technique ?? "General",
    entryType: data.entryType ?? "GENERAL",
    typedData: data.typedData ?? null,
    body: data.body ?? "",
    createdAt: now,
    updatedAt: now,
    tags: data.tags ?? [],
    attachments: data.attachments ?? [],
    authorId: data.authorId,
    version: data.version ?? 1,
  };
}

function generateId(): string {
  try {
    const runtimeCrypto = globalThis.crypto as Crypto | undefined;
    if (runtimeCrypto && typeof runtimeCrypto.randomUUID === "function") {
      return runtimeCrypto.randomUUID();
    }
  } catch {}
  return Math.random().toString(36).slice(2, 10);
}
