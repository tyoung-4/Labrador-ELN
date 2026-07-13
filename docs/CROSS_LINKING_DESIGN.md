# Cross-linking design (inventory ↔ runs ↔ projects)

Status: **approved 2026-07-13**, in build. Owner: JCW Lab / Tynan.

## Goal
From within a project, open a protocol/run, see the **exact inventory items used**
there, view their info inline, **or navigate to the item's full record.** Plus the
reverse: from an inventory item, see **which runs used it.**

## What already existed (before this build)
- `ProtocolInventoryLink` (per-protocol, author-declared) snapshotted into
  `run.linkedInventory` (JSON) at run start — but **0 of 33 runs** had any; authors
  don't use it. Rendered only in the finish-confirm modal as plain text.
- Inventory management lives at **`/inventory`** (tabs). It already deep-links:
  `/inventory?tab=plasmids&plasmidId=<id>` selects the tab and highlights + scrolls
  to the item. Only *plasmid* had the param wired.
- `/inventory/{plasmids,stocks,reagents,cell-lines}` were dead "Coming soon" stubs
  — and were the target of the Home module bar + project nav.
- Project → run already worked (project Runs tab → `/runs/[id]`).

## Decisions (all locked)
1. **Source of truth = run-time actual usage**, seeded by author links as suggestions.
2. **Granularity = item-level for v1**, schema carries an optional `lotId`
   (prep/batch/lot/passage) so we can deepen to lot-level later without a migration.
3. **Storage = real `RunInventoryUsage` table** (not JSON), with name/detail
   snapshotted so a deleted item still displays. Enables reverse lookup.
4. **Capture altitude = run-level** for v1 (optional `stepId` column reserved).
5. **Editability**: usage is editable only while the run is `IN_PROGRESS`; it locks
   with the run on completion (part of the immutable record).
6. **Reverse links** ("used in N runs") ship in v1.
7. **No stock auto-depletion** in v1 (explicit non-goal).
8. **Deleted/archived items**: snapshot name covers display; navigation degrades
   gracefully (highlight finds nothing / shows archived).
9. **Fix the `/inventory/*` stub routes** as part of this pass.

## Data model
```
RunInventoryUsage
  id, runId → ProtocolRun (onDelete: Cascade)
  itemType   "PLASMID" | "PROTEIN_STOCK" | "REAGENT" | "CELL_LINE"
  itemId                       // FK-by-convention to the inventory row
  itemName, itemDetail         // snapshot for resilience
  lotId?                       // optional prep/batch/lot/passage — future traceability
  amountUsed?, unit?, notes?   // optional metadata (no stock mutation in v1)
  addedBy, createdAt
  @@index([runId]); @@index([itemType, itemId])   // ← reverse lookup
```
`ProtocolInventoryLink` stays as the author-time *suggestion* source; the JSON
`run.linkedInventory` snapshot remains for backward-compat but is superseded for
usage by this table.

## Build order
1. Schema + `/api/runs/[id]/inventory-usage` CRUD.
2. Run-page "Inventory used" panel (add/remove, seeded from author links;
   editable only while IN_PROGRESS).
3. Clickable links → `/inventory?tab=X&<type>Id=<id>`; extend the highlight param
   to all four types; fix the stub routes.
4. Reverse links on inventory items ("Used in N runs →").
5. (Optional) project-level rollup of inventory used across the project's runs.

## Non-goals (v1)
Stock auto-depletion; per-step inventory; mandatory lot-level; editing usage on
locked/completed runs.
