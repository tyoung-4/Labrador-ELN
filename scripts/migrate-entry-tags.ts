import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all existing Entry-Tag relations via the Entry model
  const entries = await prisma.entry.findMany({
    include: { tags: true }
  })

  let migrated = 0
  let skipped = 0

  for (const entry of entries) {
    for (const tag of entry.tags) {
      try {
        await prisma.tagAssignment.upsert({
          where: {
            tagId_entityType_entityId: {
              tagId: tag.id,
              entityType: 'ENTRY',
              entityId: entry.id
            }
          },
          update: {},
          create: {
            tagId: tag.id,
            entityType: 'ENTRY',
            entityId: entry.id,
            assignedBy: 'Admin',
          }
        })
        migrated++
      } catch (e) {
        console.error(`Failed to migrate tag ${tag.id} on entry ${entry.id}:`, e)
        skipped++
      }
    }
  }

  console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
