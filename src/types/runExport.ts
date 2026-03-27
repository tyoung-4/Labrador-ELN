export type RunExportField = {
  label: string;
  unit?: string;
  value: string; // filled-in value from StepResult.fieldValues, or "" if not filled
};

export type RunExportStep = {
  index: number;                      // 1-based, continuous across all sections
  label: string;                      // "1", "2", "3" for steps; "1a", "1b" for sub-steps
  text: string;                       // parsed step text (plain)
  isSubStep: boolean;
  parentIndex: number | null;
  sectionName: string;
  status: "PASS" | "FAIL" | "SKIP" | "PENDING";
  note: string | null;                // from StepResult.notes, null if none / empty
  fields: RunExportField[];           // required fields with filled-in values
};

export type RunExportSection = {
  name: string;
  steps: RunExportStep[];
};

export type RunExportProps = {
  // Run metadata
  protocolName: string;
  version: string;
  runId: string;                      // full runId field value (or DB id as fallback)
  operator: string;
  startedAt: Date;
  completedAt: Date | null;
  exportedAt: Date;                   // always now() — set at export time
  status: "IN_PROGRESS" | "COMPLETED";
  durationSeconds: number | null;     // null if IN_PROGRESS
  runNotes: string;                   // empty string if none

  // Tags
  tags: string[];                     // tag names only, plain text

  // Stats
  passCount: number;
  failCount: number;
  skipCount: number;
  pendingCount: number;

  // Protocol body
  sections: RunExportSection[];
};
