# Antibody Designer

In-silico antibody design: create an antibody variant, annotate engineered
modifications on an interactive IgG schematic, attach binders, tag it, and link
it to a physical protein stock in Inventory. Built over four prompts on
`feature/antibody-designer-schema` (2026-07). Schema-only → SVG → annotation UI →
full pages.

## Where it lives
- **Entry point:** Knowledge Hub → "🧬 Antibody Designer" card → `/antibody-designer`.
- **List:** `/antibody-designer` — search, format filter, cards, New Antibody modal.
- **Designer:** `/antibody-designer/[id]` — schematic, annotation panel, region
  boxes, binders, protein-stock link, tags, edit modal.
- **Dev harness (temporary):** `/antibody-test` — standalone schematic+panel test
  page with mock/real data. Kept as a dev example; not linked from nav. Safe to
  delete (`rm src/app/antibody-test/page.tsx`) if unwanted.

## Data model (Prisma — added via `db push`, no migration)
- **Antibody** — `name`, `parentName?`, `format` (IgG1/2/4, bispecific, Fab, scFv…),
  `isSymmetric`, `description?`, `owner`, `createdBy`, `proteinStockId?` (soft link
  to Inventory ProteinStock), archive fields, edit tracking.
- **AntibodyAnnotation** — `type` (POINT_MUTATION | DISULFIDE | GLYCOSYLATION |
  DOMAIN_SWAP | TAG), `chain` (HEAVY_A/B, LIGHT_A/B), `region`, plus per-type
  fields: point mutation (`wtResidue`, `position`, `mutResidue`, `isNonCanonical`,
  `ncaaIdentity`, `numberingScheme` default "EU"), disulfide (`position2`,
  `chain2?`), glyco (`glycoAction`), domain swap (`swapSource`), tag (`tagIdentity`),
  `rationale?`. Cascade-deletes with the antibody.
- **AntibodyBinder** — `type` (MEDITOPE | FCR_BINDER | CUSTOM), `name`,
  `attachPoint?`, `description?`. Cascade-deletes.

### Non-canonical amino acids
Mutant residue is a canonical letter OR `"X"`. `X` sets `isNonCanonical` and
**requires** `ncaaIdentity` (e.g. "diphenylalanine", "AzF", "pAcF"). Enforced
**both** client-side (`validatePointMutation`) and server-side. Displayed as
`S22X (diphenylalanine)` via `formatMutation`.

## API surface (`/api/antibodies`)
- `GET /` (list; `?owner=&search=&archived=`; includes `_count`), `POST /` (create).
- `GET /[id]` (full: annotations + binders + `proteinStockName` + `tagAssignments`),
  `PATCH /[id]` (metadata + `proteinStockId` link/unlink), `DELETE /[id]`.
- `GET|POST /[id]/annotations`, `PATCH|DELETE /[id]/annotations/[annotationId]`.
- `GET|POST /[id]/binders`, `PATCH|DELETE /[id]/binders/[binderId]`.

**Identity & auth:** identity always comes from the **session actor**
(`getActorFromRequest`, dev `x-user-name` fallback) — clients never send
`createdBy`. All mutations gated by `canEditEntity(actor, antibody.owner)`
(owner or Admin). Validation shared in `src/lib/antibodyValidation.ts`.

## Schematic anatomy (important)
`src/components/antibody/AntibodySchematic.tsx` — SVG IgG, viewBox 600×700.
- Two Fab arms with **upright (untilted) domains** — VL|VH on top, CL|CH1 below,
  heavy chain inner; central Fc stem (CH2/CH3). The Y read comes from the hinge
  lines, not tilted boxes. **Each heavy chain's CH1 connects to its OWN CH2** (two
  separate hinge links). Blue intra-chain backbone links join stacked domains
  (VL–CL, VH–CH1, CH2–CH3). CDR loops = three ovals above each variable domain.
- **The light chain (VL+CL) terminates in the Fab arm — it does NOT bridge to the
  Fc.** Only the heavy chains (CH1→hinge→CH2→CH3) continue into the stem. (This was
  corrected in Prompt 3; the two CL→hinge connectors were removed. Don't reintroduce.)
- CDR arcs at variable tips; N/C terminus markers; binder shapes with dashed
  connectors. Colors come from `ANNOTATION_TYPES` in `src/config/antibodyRegions.ts`.
- **Symmetric mode** mirrors chain B → A: annotations, selection, and clicks all
  resolve to the canonical A chain (`canonChain`). Asymmetric renders both arms
  independently.

## Component map
- `AntibodySchematic.tsx` — the SVG + `inventoryHref`-free region clicks; exports
  `RegionSelection`, `SchematicAnnotation`, `SchematicBinder`.
- `AnnotationPanel.tsx` — slide-in right panel; `AnnotationForm` (region-gated types:
  termini→TAG, CDRs→POINT_MUTATION/DISULFIDE, else full set) + `AnnotationCard`.
- `RegionBoxes.tsx` — below-schematic list grouped by chain+region.
- `BinderSection.tsx`, `ProteinStockLink.tsx` — designer-page sections.
- `types.ts` — shared `AntibodyAnnotation` (superset, assignable to SchematicAnnotation).
- Config: `src/config/antibodyRegions.ts` (chains, regions, types, formats),
  `src/utils/aminoAcids.ts` (canonical set, `validatePointMutation`, `formatMutation`).

## Cross-feature wiring
- **Tags:** `TagInput` with `entityType="ANTIBODY"` (union widened in TagInput.tsx;
  `TagAssignment.entityType` is free-text so it persists). Read-only for non-owners.
- **Inventory:** optional link to a `ProteinStock` via `Antibody.proteinStockId`;
  the selector reads `/api/inventory/proteinstocks` (note: no hyphen); the linked
  view uses `proteinStockName` and deep-links to `/inventory?tab=proteins`.
- **Knowledge Hub:** featured card in `src/app/knowledge-hub/page.tsx`.

## Gotchas / notes
- `entityType: "ANTIBODY"` is reserved but tags are NOT yet wired into the Projects
  system (only the generic tag assignment). Extend `normalizeEntityType` if project
  scoping is ever wanted.
- No hard FK from Antibody→ProteinStock (soft `proteinStockId` string); a deleted
  stock leaves a dangling id (the link view just shows the stored name).
- Schema went in via `db push` (migration history is diverged repo-wide — never
  `migrate dev` here).
