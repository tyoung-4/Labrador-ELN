// prisma/seed.js — run with: npx prisma db seed
// Uses CommonJS so no tsx/ts-node required.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Use the existing admin user (id: "admin-user")
  const admin = await prisma.user.upsert({
    where: { email: "admin-user@local.eln" },
    update: {},
    create: {
      id:    "admin-user",
      email: "admin-user@local.eln",
      name:  "Admin",
      role:  "ADMIN",
    },
  });

  const RECIPES = [
    {
      name: "Crystal Buffer A",
      description: "Crystallisation buffer, pH 8.0",
      components: [
        { reagentName: "Tris-HCl (pH 8.0)", concentration: 20,  unit: "mM", notes: "pH 8.0", order: 0 },
        { reagentName: "NaCl",              concentration: 50,  unit: "mM", notes: "",        order: 1 },
      ],
    },
    {
      name: "Lysis Buffer",
      description: "General cell lysis buffer, pH 7.5",
      components: [
        { reagentName: "Tris-HCl (pH 7.5)", concentration: 50,  unit: "mM",  notes: "pH 7.5", order: 0 },
        { reagentName: "NaCl",              concentration: 150, unit: "mM",  notes: "",        order: 1 },
        { reagentName: "EDTA",              concentration: 1,   unit: "mM",  notes: "",        order: 2 },
        { reagentName: "Triton X-100",      concentration: 1,   unit: "%",   notes: "",        order: 3 },
      ],
    },
    {
      name: "PBS",
      description: "Phosphate-buffered saline, pH 7.4",
      components: [
        { reagentName: "NaCl",      concentration: 137, unit: "mM", notes: "",        order: 0 },
        { reagentName: "KCl",       concentration: 2.7, unit: "mM", notes: "",        order: 1 },
        { reagentName: "Na₂HPO₄",   concentration: 10,  unit: "mM", notes: "pH 7.4", order: 2 },
        { reagentName: "KH₂PO₄",    concentration: 1.8, unit: "mM", notes: "",        order: 3 },
      ],
    },
    {
      name: "SEC Running Buffer",
      description: "Size-exclusion chromatography running buffer, pH 7.5",
      components: [
        { reagentName: "HEPES (pH 7.5)", concentration: 20,  unit: "mM", notes: "pH 7.5", order: 0 },
        { reagentName: "NaCl",           concentration: 150, unit: "mM", notes: "",        order: 1 },
        { reagentName: "TCEP",           concentration: 0.5, unit: "mM", notes: "",        order: 2 },
      ],
    },
    {
      name: "Ni-NTA Wash Buffer",
      description: "IMAC wash buffer, pH 8.0",
      components: [
        { reagentName: "NaH₂PO₄ (pH 8.0)", concentration: 50,  unit: "mM", notes: "pH 8.0", order: 0 },
        { reagentName: "NaCl",              concentration: 300, unit: "mM", notes: "",        order: 1 },
        { reagentName: "Imidazole",         concentration: 20,  unit: "mM", notes: "",        order: 2 },
      ],
    },
    {
      name: "Ni-NTA Elution Buffer",
      description: "IMAC elution buffer, pH 8.0",
      components: [
        { reagentName: "NaH₂PO₄ (pH 8.0)", concentration: 50,  unit: "mM", notes: "pH 8.0", order: 0 },
        { reagentName: "NaCl",              concentration: 300, unit: "mM", notes: "",        order: 1 },
        { reagentName: "Imidazole",         concentration: 250, unit: "mM", notes: "",        order: 2 },
      ],
    },
  ];

  let seeded = 0;
  let skipped = 0;

  for (const recipe of RECIPES) {
    const existing = await prisma.recipe.findFirst({ where: { name: recipe.name } });
    if (existing) {
      console.log(`  skip  "${recipe.name}" (already exists)`);
      skipped++;
      continue;
    }
    await prisma.recipe.create({
      data: {
        name:        recipe.name,
        description: recipe.description,
        createdById: admin.id,
        components: {
          create: recipe.components,
        },
      },
    });
    console.log(`  seeded "${recipe.name}"`);
    seeded++;
  }

  console.log(`\nDone: ${seeded} seeded, ${skipped} skipped.`);

  // ── General project ─────────────────────────────────────────────────────────
  // The single shared "General" project. Reconciled onto the Tag model
  // (type: PROJECT) rather than a separate Project table. It has no owner,
  // cannot be deleted or made private, and appears under All Projects only.
  {
    // Tag.name is globally unique, so reconcile any existing "General" tag
    // (e.g. a legacy GENERAL-type one) into the General project rather than
    // creating a duplicate. Promotion is only safe when it has no assignments.
    const existing = await prisma.tag.findFirst({
      where: { name: { equals: "General", mode: "insensitive" } },
      include: { _count: { select: { assignments: true } } },
    });
    const projectData = {
      type: "PROJECT",
      color: "#6B7280",
      createdBy: "system",
      owner: null,
      isGeneral: true,
      isPrivate: false,
      description: "General protocols, common reagents, and shared resources",
    };
    if (!existing) {
      await prisma.tag.create({ data: { name: "General", ...projectData } });
      console.log(`  seeded General project`);
    } else if (existing.isGeneral && existing.type === "PROJECT") {
      console.log(`  skip  General project (already configured)`);
    } else if (existing.type === "GENERAL" && existing._count.assignments > 0) {
      console.log(`  WARN  existing "General" tag has assignments — left as-is, General project NOT created`);
    } else {
      await prisma.tag.update({ where: { id: existing.id }, data: projectData });
      console.log(`  promoted existing "General" tag to the General project`);
    }
  }

  // ── Ladder library ─────────────────────────────────────────────────────────
  const LADDERS = [
    { name: "PageRuler Prestained",              manufacturer: "Thermo Fisher", bands: [10,15,25,35,55,70,100,130,180] },
    { name: "PageRuler Plus Prestained",          manufacturer: "Thermo Fisher", bands: [3.5,5,10,15,25,35,55,70,100,130,180,245] },
    { name: "Precision Plus Protein Unstained",   manufacturer: "Bio-Rad",       bands: [10,15,20,25,37,50,75,100,150,250] },
    { name: "Precision Plus Protein Dual Color",  manufacturer: "Bio-Rad",       bands: [10,15,20,25,37,50,75,100,150,250] },
    { name: "HiMark Pre-stained",                 manufacturer: "Thermo Fisher", bands: [30,40,50,60,80,110,160,260,460] },
    { name: "NativeMark Unstained",               manufacturer: "Thermo Fisher", bands: [20,66,146,242,480,720,1200] },
    { name: "1 kb Plus DNA Ladder",               manufacturer: "Thermo Fisher", bands: [0.1,0.2,0.3,0.4,0.5,0.65,0.85,1,1.2,1.5,2,3,4,5,6,8,10,12] },
    { name: "100 bp DNA Ladder",                  manufacturer: "NEB",           bands: [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1,1.2,1.5,2,3] },
  ];

  let ladderSeeded = 0, ladderSkipped = 0;
  for (const ladder of LADDERS) {
    const exists = await prisma.ladderDefinition.findFirst({ where: { name: ladder.name } });
    if (exists) { console.log(`  skip  ladder "${ladder.name}"`); ladderSkipped++; continue; }
    await prisma.ladderDefinition.create({
      data: { name: ladder.name, manufacturer: ladder.manufacturer, bands: JSON.stringify(ladder.bands) },
    });
    console.log(`  seeded ladder "${ladder.name}"`);
    ladderSeeded++;
  }
  console.log(`\nLadders: ${ladderSeeded} seeded, ${ladderSkipped} skipped.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
