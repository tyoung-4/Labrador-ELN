import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(len = 9): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Build the ProtocolBodyJSON format that the app reads:
// Entry.body = JSON.stringify({ steps: JSON.stringify(stepsData) })
function makeProtocolBody(sections: Array<{
  title: string;
  steps: Array<{
    text: string;
    fields?: Array<{ id: string; kind: string; label: string; unit?: string }>;
    subSteps?: Array<{ text: string }>;
  }>;
}>): string {
  const stepsData = {
    version: 2,
    sections: sections.map((sec) => ({
      id: makeId(),
      title: sec.title,
      steps: sec.steps.map((step) => ({
        id: makeId(),
        text: step.text,
        fields: step.fields ?? [],
        subSteps: (step.subSteps ?? []).map((sub) => ({
          id: makeId(),
          text: sub.text,
          fields: [],
          subSteps: [],
        })),
      })),
    })),
  };
  return JSON.stringify({ steps: JSON.stringify(stepsData) });
}

// ── Users ─────────────────────────────────────────────────────────────────────

const USERS = [
  { email: "admin@labrador.eln",              name: "Admin",             role: "ADMIN"  },
  { email: "finn@labrador.eln",               name: "Finn",              role: "MEMBER" },
  { email: "jake@labrador.eln",               name: "Jake",              role: "MEMBER" },
  { email: "marceline@labrador.eln",          name: "Marceline",         role: "MEMBER" },
  { email: "princess.bubblegum@labrador.eln", name: "Princess Bubblegum",role: "MEMBER" },
];

// ── Demo protocol body ────────────────────────────────────────────────────────

const DEMO_PROTOCOL_BODY = makeProtocolBody([
  {
    title: "Section 1: Using the Protocol Editor",
    steps: [
      {
        text: 'Use "Add Section" to create a new section. Sections group related steps together and must have a name.',
      },
      {
        text: 'Use "Add Step" to add steps under a section. Steps are the main actions of your protocol and are numbered continuously across all sections.',
        subSteps: [
          { text: 'Use "Add Sub-step" to add a minor action under an existing step. Sub-steps are labeled 1a, 1b, 1c and so on.' },
        ],
      },
      {
        text: 'Use "+ Required Field" to attach a requisite input field to a step — these must be recorded during the run. They are typically inputs subject to changing experimental conditions (e.g., cell count/viability, concentration of protein/DNA, etc.)',
      },
      {
        text: 'Click "Save" when finished. The protocol is saved as v1.0. Editing and saving again increments the version.',
      },
    ],
  },
  {
    title: "Section 2: Running a Protocol",
    steps: [
      {
        text: 'From the Protocol List, open any protocol and click "Run Protocol".',
      },
      {
        text: "Confirm the run when prompted. The run starts immediately and is assigned a unique Run ID.",
      },
      {
        text: "The left panel shows the full protocol. The active step is highlighted with a dashed border.",
      },
      {
        text: "For each step, click Pass, Fail, or Skip in the right sidebar. Steps must be completed in order.",
        subSteps: [
          { text: "Passed steps turn green. Failed steps turn red. Skipped steps turn gray." },
        ],
      },
      {
        text: "The dog progress bar tracks your progress across all steps.",
      },
      {
        text: 'Add inline notes to any step by clicking "Add note" directly on the step row.',
      },
      {
        text: 'When all steps are resolved, add final run notes and click "Finish Run" to complete the run.',
      },
    ],
  },
  {
    title: "Section 3: Tips and Conventions",
    steps: [
      {
        text: "Clone a protocol to edit another person's experiment — this preserves the original template.",
      },
      {
        text: "Protocol versions increment only when you edit and save. Cloning resets to v1.0.",
      },
      {
        text: "Run IDs are unique 10-character alphanumeric codes — use them to identify runs even on the same protocol.",
      },
      {
        text: "Use the Fetch search (Cmd+K) to find any protocol, run, or entry across the ELN [to be implemented].",
      },
    ],
  },
]);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database…");

  // 1. Upsert users
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { email: u.email, name: u.name, role: u.role },
    });
    console.log(`  ✓ User: ${user.name} (${user.role})`);
  }

  // 2. Find admin user for authorship
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@labrador.eln" } });

  // 3. Upsert demo protocol (via Entry + Protocol)
  const PROTOCOL_TITLE = "How to use Protocol Editor and Runner";

  const existingEntry = await prisma.entry.findFirst({
    where: { title: PROTOCOL_TITLE, entryType: "PROTOCOL" },
    include: { protocol: true },
  });

  if (existingEntry) {
    // Update body/version in case seed is re-run after manual edits
    await prisma.entry.update({
      where: { id: existingEntry.id },
      data: {
        body: DEMO_PROTOCOL_BODY,
        version: 1,
        description:
          "A walkthrough of the Labrador ELN Protocol Editor and Protocol Runner. Use this as a reference when creating and running your first protocol.",
        technique: "General",
        updatedAt: new Date(),
      },
    });
    if (existingEntry.protocol) {
      await prisma.protocol.update({
        where: { id: existingEntry.protocol.id },
        data: {
          name: PROTOCOL_TITLE,
          technique: "General",
          shortDescription:
            "A walkthrough of the Labrador ELN Protocol Editor and Protocol Runner.",
        },
      });
    }
    console.log(`  ✓ Protocol updated: "${PROTOCOL_TITLE}"`);
  } else {
    const entry = await prisma.entry.create({
      data: {
        title: PROTOCOL_TITLE,
        description:
          "A walkthrough of the Labrador ELN Protocol Editor and Protocol Runner. Use this as a reference when creating and running your first protocol.",
        technique: "General",
        entryType: "PROTOCOL",
        body: DEMO_PROTOCOL_BODY,
        version: 1,
        authorId: admin.id,
        typedData: {},
        protocol: {
          create: {
            name: PROTOCOL_TITLE,
            technique: "General",
            shortDescription:
              "A walkthrough of the Labrador ELN Protocol Editor and Protocol Runner.",
          },
        },
      },
    });
    console.log(`  ✓ Protocol created: "${entry.title}" (id: ${entry.id})`);
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
