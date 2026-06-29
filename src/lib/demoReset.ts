import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { recordAudit, snapshotHash } from "@/lib/audit";

// ─── Seeded users ────────────────────────────────────────────────────────────
const SEED_USERS = [
  { id: "finn-user", name: "Finn", role: "MEMBER" },
  { id: "jake-user", name: "Jake", role: "MEMBER" },
  { id: "admin-user", name: "Admin", role: "ADMIN" },
  { id: "pb-user", name: "Princess Bubblegum", role: "MEMBER" },
  { id: "marceline-user", name: "Marceline", role: "MEMBER" },
];

// ─── Protocol body builder (matches the editor's stored shape) ────────────────
type StepField = { kind: "measurement"; label: string; unit?: string };
type SeedStep = { text: string; fields?: StepField[] };
type SeedSection = { title: string; steps: SeedStep[] };

function buildProtocolBody(sections: SeedSection[]): string {
  const stepsObj = {
    version: 2,
    sections: sections.map((s, si) => ({
      id: `sec${si}`,
      title: s.title,
      steps: s.steps.map((st, sti) => ({
        id: `s${si}_${sti}`,
        text: st.text,
        fields: (st.fields ?? []).map((f, fi) => ({ id: `f${si}_${sti}_${fi}`, ...f })),
        subSteps: [],
      })),
    })),
  };
  return JSON.stringify({
    steps: JSON.stringify(stepsObj),
    description: "",
    guidelines: "",
    references: [],
    materials: [],
  });
}

const TYPED_V1 = { typed: { _semVer: "1.0" }, custom: [] as string[] };
const DEFAULT_INTERACTION = JSON.stringify({
  stepCompletion: {}, components: {}, componentAmounts: {}, entryFields: {}, timers: {}, currentStepIdx: 0,
});

/**
 * Wipe ALL application data and restore a populated demo. Destructive — only
 * ever call against the throwaway demo DB (the route guards on
 * NEXT_PUBLIC_ENV_LABEL === "staging" + a secret token).
 */
export async function resetDemoData() {
  // 1. TRUNCATE every public table except the migration history.
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length > 0) {
    const list = rows.map((r) => `"${r.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }

  // 2. Users
  const passwordHash = await hashPassword(process.env.ELN_SEED_PASSWORD || "labrador");
  for (const u of SEED_USERS) {
    await prisma.user.create({
      data: { id: u.id, name: u.name, role: u.role, email: `${u.id}@local.eln`, passwordHash, isActive: true },
    });
  }

  // 3. Projects (Tag type=PROJECT) + members
  const general = await prisma.tag.create({
    data: { name: "General", type: "PROJECT", color: "#6B7280", createdBy: "system", isGeneral: true,
      description: "General protocols, common reagents, and shared resources" },
  });
  const projCd38 = await prisma.tag.create({
    data: { name: "CD38 Antibody Engineering", type: "PROJECT", color: "#8b5cf6", createdBy: "Jake", owner: "Jake",
      description: "Discovery and characterization of anti-CD38 antibodies." },
  });
  const projPurif = await prisma.tag.create({
    data: { name: "Membrane Protein Purification", type: "PROJECT", color: "#14b8a6", createdBy: "Finn", owner: "Finn",
      description: "ÄKTA-based purification and QC of His-tagged ectodomains." },
  });
  await prisma.projectMember.createMany({
    data: [
      { tagId: projCd38.id, userId: "jake-user" },
      { tagId: projCd38.id, userId: "finn-user" },
      { tagId: projCd38.id, userId: "pb-user" },
      { tagId: projPurif.id, userId: "finn-user" },
      { tagId: projPurif.id, userId: "marceline-user" },
    ],
    skipDuplicates: true,
  });

  // 4. GENERAL tags
  const gtagDefs = [
    ["CD38", "#ec4899"], ["AKTA", "#06b6d4"], ["SDS-PAGE", "#f97316"],
    ["Cloning", "#22c55e"], ["Expi293", "#3b82f6"],
  ] as const;
  const gtags: Record<string, string> = {};
  for (const [name, color] of gtagDefs) {
    const t = await prisma.tag.create({ data: { name, type: "GENERAL", color, createdBy: "Jake" } });
    gtags[name] = t.id;
  }

  // 5. Inventory
  const plUC = await prisma.plasmid.create({
    data: { name: "pET28a-CD38ecto", backbone: "pET28a(+)", insert: "CD38 ectodomain (His6)", resistance: "Kanamycin", owner: "Finn", location: "Box P1 / A3" },
  });
  const plHC = await prisma.plasmid.create({
    data: { name: "pcDNA3.4-aCD38-HC", backbone: "pcDNA3.4", insert: "anti-CD38 heavy chain (IgG1)", resistance: "Ampicillin", owner: "Jake", location: "Box P1 / B1" },
  });
  await prisma.plasmid.create({
    data: { name: "pcDNA3.4-aCD38-LC", backbone: "pcDNA3.4", insert: "anti-CD38 kappa light chain", resistance: "Ampicillin", owner: "Jake", location: "Box P1 / B2" },
  });

  await prisma.cellLine.create({ data: { name: "Expi293F", species: "Homo sapiens", passage: 14, owner: "Jake", location: "LN2 Tower 2 / Box 4" } });
  await prisma.cellLine.create({ data: { name: "HEK293T", species: "Homo sapiens", passage: 22, owner: "Princess Bubblegum", location: "LN2 Tower 2 / Box 1" } });

  await prisma.inventoryReagent.createMany({
    data: [
      { name: "Tris-HCl, 1 M pH 8.0", category: "buffer", quantity: 500, unit: "mL", location: "Shelf B2", owner: "Finn", vendor: "Sigma" },
      { name: "Imidazole, 2 M", category: "buffer", quantity: 250, unit: "mL", location: "Shelf B2", owner: "Finn", vendor: "Sigma" },
      { name: "PBS, 10X", category: "buffer", quantity: 1000, unit: "mL", location: "Shelf B1", owner: "Princess Bubblegum", vendor: "Gibco" },
      { name: "ExpiFectamine 293", category: "transfection", quantity: 2, unit: "mL", location: "-20 °C Door", owner: "Jake", vendor: "Thermo", catalogNumber: "A14524" },
      { name: "Kanamycin, 50 mg/mL", category: "antibiotic", quantity: 10, unit: "mL", location: "-20 °C Door", owner: "Finn" },
    ],
  });

  const stkAb = await prisma.proteinStock.create({
    data: { name: "anti-CD38 IgG1 (clone JK-1)", concentration: 2.4, concUnit: "mg/mL", volume: 1500, volUnit: "µL", purity: ">95% (SEC)", owner: "Jake", location: "-80 °C Box A2", plasmidId: plHC.id },
  });
  const stkEcto = await prisma.proteinStock.create({
    data: { name: "CD38 ectodomain-His6", concentration: 1.1, concUnit: "mg/mL", volume: 800, volUnit: "µL", purity: ">90%", owner: "Finn", location: "-80 °C Box A2", plasmidId: plUC.id },
  });
  await prisma.proteinBatch.create({
    data: {
      batchId: "JK1-20260601-A", stockId: stkAb.id, purificationDate: new Date("2026-06-01"),
      initialVolume: 1500, currentVolume: 1500, concentration: 2.4, mw: 148, storageBuffer: "1X PBS pH 7.4",
      storageLocationText: "-80 °C Box A2 / pos 5", volumeUnit: "µL", createdBy: "Jake",
    },
  });

  // 6. Protocols (Entry, PUBLISHED)
  const protoExpr = await prisma.entry.create({
    data: {
      title: "Anti-CD38 Antibody Expression (Expi293F)", entryType: "PROTOCOL", status: "PUBLISHED",
      technique: "Mammalian Expression", version: 1, typedData: TYPED_V1, authorId: "jake-user",
      description: "Transient expression of anti-CD38 IgG1 in Expi293F.",
      publishedAt: new Date("2026-05-20"),
      body: buildProtocolBody([
        { title: "Transfection", steps: [
          { text: "Confirm Expi293F at 3×10⁶ cells/mL and ≥95% viable.", fields: [{ kind: "measurement", label: "Viability", unit: "%" }] },
          { text: "Complex HC + LC plasmid DNA with ExpiFectamine 293; add to culture." },
        ]},
        { title: "Expression & harvest", steps: [
          { text: "Incubate 37 °C, 8% CO₂, 125 rpm; add enhancers 18–22 h post-transfection." },
          { text: "Harvest on day 5; centrifuge 4000×g, 20 min; 0.22 µm filter supernatant.", fields: [{ kind: "measurement", label: "Final volume", unit: "mL" }] },
        ]},
      ]),
    },
  });
  const protoPurif = await prisma.entry.create({
    data: {
      title: "IMAC Purification on ÄKTA", entryType: "PROTOCOL", status: "PUBLISHED",
      technique: "Protein Purification", version: 1, typedData: TYPED_V1, authorId: "finn-user",
      description: "His-tag capture of CD38 ectodomain on a HisTrap column.",
      publishedAt: new Date("2026-05-22"),
      body: buildProtocolBody([
        { title: "Equilibration", steps: [
          { text: "Equilibrate HisTrap HP with 5 CV Buffer A (20 mM Tris, 300 mM NaCl, 20 mM imidazole).", fields: [{ kind: "measurement", label: "Column volume", unit: "mL" }] },
        ]},
        { title: "Load & wash", steps: [
          { text: "Load clarified lysate at 1 mL/min.", fields: [{ kind: "measurement", label: "A280 at load", unit: "mAU" }] },
          { text: "Wash with 10 CV Buffer A until baseline." },
        ]},
        { title: "Elution", steps: [
          { text: "Elute with 20→500 mM imidazole gradient; collect peak fractions.", fields: [{ kind: "measurement", label: "Peak A280", unit: "mAU" }] },
        ]},
      ]),
    },
  });
  const protoQc = await prisma.entry.create({
    data: {
      title: "SDS-PAGE QC (reducing)", entryType: "PROTOCOL", status: "PUBLISHED",
      technique: "Western Blot / SDS-PAGE", version: 1, typedData: TYPED_V1, authorId: "pb-user",
      description: "Reducing SDS-PAGE to confirm purity and chain assembly.",
      publishedAt: new Date("2026-05-25"),
      body: buildProtocolBody([
        { title: "Run", steps: [
          { text: "Mix 2 µg protein with reducing loading dye; heat 95 °C, 5 min." },
          { text: "Load 4–12% Bis-Tris gel; run 200 V, 35 min; stain with Coomassie." },
        ]},
      ]),
    },
  });

  // 7. Runs — one signed/completed (purification, by Finn) + one in-progress (expression, by Jake)
  const runPurif = await prisma.protocolRun.create({
    data: {
      runId: "DEMOAKTA01", title: `${protoPurif.title} - Run 1`, status: "COMPLETED", locked: true,
      runBody: protoPurif.body, interactionState: DEFAULT_INTERACTION, operatorName: "Finn", runnerId: "finn-user",
      sourceEntryId: protoPurif.id, completedAt: new Date("2026-05-23"), createdAt: new Date("2026-05-23"),
    },
  });
  await prisma.stepResult.createMany({
    data: [0, 1, 2, 3].map((i) => ({ runId: runPurif.id, stepId: `step-${i}`, result: "PASSED", notes: "" })),
  });
  const sig = await prisma.signature.create({
    data: {
      entityType: "RUN", entityId: runPurif.id, signerId: "finn-user", signerName: "Finn", meaning: "COMPLETION",
      statement: "I confirm these results are accurate and complete.",
      contentHash: snapshotHash({ id: runPurif.id, status: "COMPLETED", runBody: runPurif.runBody }),
    },
  });
  void sig;
  await recordAudit({ entityType: "RUN", entityId: runPurif.id, action: "SIGN", actor: { id: "finn-user", name: "Finn" }, summary: "COMPLETION signed by Finn" });
  await recordAudit({ entityType: "RUN", entityId: runPurif.id, action: "LOCK", actor: { id: "finn-user", name: "Finn" }, summary: "Run locked on signature" });

  const runExpr = await prisma.protocolRun.create({
    data: {
      runId: "DEMOEXPR01", title: `${protoExpr.title} - Run 1`, status: "IN_PROGRESS", locked: true,
      runBody: protoExpr.body, interactionState: DEFAULT_INTERACTION, operatorName: "Jake", runnerId: "jake-user",
      sourceEntryId: protoExpr.id,
    },
  });

  // 8. Tag assignments — link items to projects + general tags
  const A = (tagId: string, entityType: string, entityId: string, assignedBy = "Jake") => ({ tagId, entityType, entityId, assignedBy });
  await prisma.tagAssignment.createMany({
    data: [
      // project membership of items
      A(projCd38.id, "ENTRY", protoExpr.id, "Jake"),
      A(projCd38.id, "ENTRY", protoQc.id, "Jake"),
      A(projCd38.id, "RUN", runExpr.id, "Jake"),
      A(projCd38.id, "PLASMID", plHC.id, "Jake"),
      A(projCd38.id, "PROTEIN_STOCK", stkAb.id, "Jake"),
      A(projPurif.id, "ENTRY", protoPurif.id, "Finn"),
      A(projPurif.id, "RUN", runPurif.id, "Finn"),
      A(projPurif.id, "PLASMID", plUC.id, "Finn"),
      A(projPurif.id, "PROTEIN_STOCK", stkEcto.id, "Finn"),
      // descriptive GENERAL tags
      A(gtags["Expi293"], "ENTRY", protoExpr.id, "Jake"),
      A(gtags["CD38"], "ENTRY", protoExpr.id, "Jake"),
      A(gtags["AKTA"], "ENTRY", protoPurif.id, "Finn"),
      A(gtags["SDS-PAGE"], "ENTRY", protoQc.id, "PB"),
      A(gtags["CD38"], "PROTEIN_STOCK", stkAb.id, "Jake"),
      A(gtags["AKTA"], "RUN", runPurif.id, "Finn"),
    ],
    skipDuplicates: true,
  });

  // 9. Recipes
  const lysis = await prisma.recipe.create({
    data: { name: "Lysis Buffer (His-tag)", createdById: "finn-user", description: "For bacterial lysis prior to IMAC." },
  });
  await prisma.recipeComponent.createMany({
    data: [
      { recipeId: lysis.id, reagentName: "Tris-HCl pH 8.0", concentration: 20, unit: "mM", order: 0 },
      { recipeId: lysis.id, reagentName: "NaCl", concentration: 300, unit: "mM", order: 1 },
      { recipeId: lysis.id, reagentName: "Imidazole", concentration: 20, unit: "mM", order: 2 },
    ],
  });

  // 10. A couple of gel ladders (for gel/chromatogram annotation)
  await prisma.ladderDefinition.createMany({
    data: [
      { name: "PageRuler Prestained", manufacturer: "Thermo Fisher", bands: JSON.stringify([10, 15, 25, 35, 55, 70, 100, 130, 180]) },
      { name: "Precision Plus Protein Dual Color", manufacturer: "Bio-Rad", bands: JSON.stringify([10, 15, 20, 25, 37, 50, 75, 100, 150, 250]) },
    ],
  });

  return {
    users: SEED_USERS.length,
    projects: 3,
    protocols: 3,
    runs: 2,
    inventory: { plasmids: 3, cellLines: 2, reagents: 5, proteinStocks: 2, batches: 1 },
    tablesTruncated: rows.length,
  };
}
