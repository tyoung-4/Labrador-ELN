// Demo / sandbox-mode flags. The public demo sets NEXT_PUBLIC_ENV_LABEL=staging
// (which also drives the "data cleared periodically" banner in the root layout).

export const DEMO_MODE = process.env.NEXT_PUBLIC_ENV_LABEL === "staging";

// One-click guest entry is allowed in the public demo AND in local dev (so it's
// testable); it is NEVER enabled in a real, non-demo production deployment.
export const GUEST_ENTRY_ENABLED =
  DEMO_MODE || process.env.NODE_ENV !== "production";

// Seeded personas a guest may enter the demo as.
export const GUEST_USER_IDS = [
  "finn-user",
  "jake-user",
  "admin-user",
  "pb-user",
  "marceline-user",
] as const;

export const DEFAULT_GUEST_ID = "finn-user";
