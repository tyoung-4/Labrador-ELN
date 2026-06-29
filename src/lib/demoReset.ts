import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

// Baseline seed restored after a demo wipe (enough to log in and use the app).
const SEED_USERS = [
  { id: "finn-user", name: "Finn", role: "MEMBER" },
  { id: "jake-user", name: "Jake", role: "MEMBER" },
  { id: "admin-user", name: "Admin", role: "ADMIN" },
  { id: "pb-user", name: "Princess Bubblegum", role: "MEMBER" },
  { id: "marceline-user", name: "Marceline", role: "MEMBER" },
];

/**
 * Wipe ALL application data and restore the baseline seed. Destructive — only
 * ever call this against the throwaway demo database (the route guards on
 * NEXT_PUBLIC_ENV_LABEL === "staging" + a secret token).
 */
export async function resetDemoData() {
  // TRUNCATE every public table except the migration history; CASCADE handles
  // FK ordering and RESTART IDENTITY resets sequences.
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;

  if (rows.length > 0) {
    const list = rows.map((r) => `"${r.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }

  const passwordHash = await hashPassword(process.env.ELN_SEED_PASSWORD || "labrador");
  for (const u of SEED_USERS) {
    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        role: u.role,
        email: `${u.id}@local.eln`,
        passwordHash,
        isActive: true,
      },
    });
  }

  // The "General" project (Tag type=PROJECT, isGeneral).
  await prisma.tag.create({
    data: {
      name: "General",
      type: "PROJECT",
      color: "#6B7280",
      createdBy: "system",
      isGeneral: true,
      description: "General protocols, common reagents, and shared resources",
    },
  });

  return { tablesTruncated: rows.length, usersSeeded: SEED_USERS.length };
}
