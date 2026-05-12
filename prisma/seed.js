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
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
