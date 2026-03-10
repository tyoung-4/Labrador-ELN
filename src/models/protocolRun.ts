export type StepResult = {
  id: string;
  runId: string;
  stepId: string;
  result: "PASSED" | "FAILED" | "SKIPPED";
  notes: string;
  fieldValues: string; // JSON string
  completedAt: string;
};

export type ProtocolRun = {
  id: string;
  runId?: string | null;
  title: string;
  status: string;
  locked: boolean;
  runBody: string;
  notes: string;
  interactionState: string;
  operatorName: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceEntryId: string;
  runnerId?: string | null;
  sourceEntry?: {
    id: string;
    title: string;
    description: string;
    technique?: string;
    author?: {
      id: string;
      name: string | null;
      role: string;
    } | null;
  };
  runner?: {
    id: string;
    name: string | null;
    role: string;
  } | null;
  stepResults?: StepResult[];
};
