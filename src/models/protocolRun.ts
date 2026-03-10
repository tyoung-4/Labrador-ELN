export type StepResult = {
  id: string;
  runId: string;
  stepId: string;
  result: "PASSED" | "FAILED" | "SKIPPED";
  notes: string;
  fieldValues: string; // JSON string
  completedAt: string;
};

export type RunProtocolStep = {
  id: string;
  stepType: string;
  parentStepId: string | null;
  estimatedMinutes: number | null;
};

export type RunProtocolSection = {
  id: string;
  name: string;
  order: number;
  steps: RunProtocolStep[];
};

export type RunProtocol = {
  id: string;
  name: string | null;
  technique: string | null;
  shortDescription: string | null;
  sections: RunProtocolSection[];
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
  protocolId?: string | null;
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
  protocol?: RunProtocol | null;
  stepResults?: StepResult[];
};
