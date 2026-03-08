# ELN — Product Specification

> A lightweight, vibe-coded Electronic Lab Notebook for a small academic research team.

---

## 1. Overview

This is the product specification for a custom Electronic Lab Notebook (ELN) web application built for a ~15-person structural biology and cancer therapeutics research lab.

### Design Philosophy

Three principles are the north star for every design decision:

1. **Dashboard-first.** The ELN opens on the Dashboard. The schedule (daily/weekly), ToDo list, and equipment calendar are front and center. Every other feature is reachable in ≤4 clicks from the Dashboard, with very few justified exceptions. Navigation should feel flat, not hierarchical.

2. **Reproducibility through structured records.** Protocols with typed, versioned steps and linked reagents enable consistent execution. Run records capture deviations per step. Reagent and stock tracking provides the metadata lineage needed for data mining — knowing not just what was done but with exactly what.

3. **Everything is searchable.** A persistent global search bar (⌘+K) spans all domains — protocols, runs, inventory items, reagents, experiments, equipment bookings, knowledge hub entries. Every piece of data entered into the ELN should be findable from a single query.

This ELN is **not** a LIMS, not a cryo-EM processing pipeline, and not an enterprise compliance platform. It replaces paper notebooks and scattered Google Docs with a single, searchable, linkable system for documenting bench work.

### Lab Profile

| Detail | Description |
|--------|-------------|
| **Size** | ~15 members (PI, postdocs, grad students, technicians) |
| **Setting** | Cancer research institute, academic |
| **Core techniques** | Proximity labeling (TurboID), cryo-EM sample prep, X-ray crystallography, antibody engineering, protein purification (SEC, affinity), cell-based assays |
| **Typical data captured in ELN** | Gel images (SDS-PAGE, Western blots), SEC/FPLC chromatography traces, plate reader outputs, crystallization drop images, cloning/mutagenesis records, buffer recipes, transfection conditions |
| **Data NOT captured in ELN** | Raw cryo-EM data (.mrc, .star, .cs files), reconstruction volumes, synchrotron diffraction data — these are managed in dedicated pipelines (cryoSPARC, RELION, HKL-3000, etc.) |

### Scope Boundaries

- **In scope:** Experiment documentation, protocol management with Run Mode, equipment booking and scheduling, typed data ingestion, inventory tracking, knowledge hub, global search, file attachments.
- **Out of scope (current):** Cryo-EM/synchrotron raw data storage, mobile-responsive design, 21 CFR Part 11 compliance, LIMS workflows, instrument auto-import, barcoding, e-signatures.
- **Explicit exclusion:** `.mrc`, `.star`, `.cs`, `.mtz`, `.sca` and other large-format structural data files. These live in cryoSPARC, RELION, or institutional storage. The ELN may store *references* (links, session IDs, processing notes) to these datasets but never the files themselves.

---

## 2. Reference Platform Analysis

Four commercial ELNs were evaluated to inform the feature set. The goal was to identify proven UX patterns worth adopting and common pitfalls to avoid.

### Labguru
- **What works:** Project → Folder → Experiment hierarchy. Linked Resources connecting experiments to inventory items, protocols, and equipment. Customizable inventory categories. API for integrations.
- **What doesn't:** Complex onboarding. Limited table editing (no multi-cell paste). Image annotation tools lack alignment and color options.
- **Adopted pattern:** Hierarchical project organization. Bidirectional linking between entries and inventory.

### Benchling
- **What works:** Entity registration — unique, searchable records for plasmids, cell lines, antibodies, constructs, all linked to experiments. @-mention cross-referencing between entries. Excellent search. Free academic tier for Notebook + Molecular Biology tools.
- **What doesn't:** Enterprise pricing for full platform. Registry/Inventory/Workflows are overkill for a small academic lab.
- **Adopted pattern:** Entity registration concept (simplified). @-mention linking between entries.

### SciNote
- **What works:** Open-source core (Mozilla Public License 2.0). Interactive protocol checklists with completable steps. Visual experiment workflow view. RESTful API. Project/experiment/task structure.
- **What doesn't:** Tables are clunky. Limited calendar integration. Customization feels rigid. Premium features gated.
- **Adopted pattern:** Interactive protocol steps with checkboxes, timestamps, and per-step notes. Open-source reference architecture.

### Revvity Signals Notebook
- **What works:** Drag-and-drop file attachment with inline preview. Locked worksheets for SOP enforcement. Image upload with annotation. Intuitive, modern UI. MS Office inline editing.
- **What doesn't:** Enterprise-priced. Workflow engine relies on Spotfire plugins. Slow support. Built for pharma, not academia.
- **Adopted pattern:** Drag-and-drop attachments with inline image preview. Lockable protocol templates.

---

## 3. Feature Set

Features are marked: **[built]**, **[in progress]**, or **[planned]**.

### 3.1 Dashboard

The entry point and primary workspace. All lab activity converges here.

| Feature | Status |
|---------|--------|
| Daily schedule (pixel-grid, 12:00 am – 11:59 pm, 48 px/hr) | [built] |
| Weekly schedule view with weekend toggle | [built] |
| Day/week navigation arrows + permanent Today button | [built] |
| Default scroll window: current time −1 h to +5 h | [built] |
| ToDo list with drag-to-reorder | [built] |
| ToDo add form: collapsible notes toggle, time-sensitive checkbox, inline date+time, overnight booking support | [built] |
| Drag todo item onto daily schedule to create a new scheduled event | [built] |
| Equipment calendar widget (single resource group, switchable) | [built] |
| Real-time global clock | [built] |
| Persistent todo history (saved to DB on day rollover) | [built] |
| Global search bar (⌘+K) | [planned] |

### 3.2 Protocols

Reusable, versioned SOPs with interactive Run Mode.

| Feature | Status |
|---------|--------|
| Protocol editor (rich text, sections, typed steps) | [built] |
| Step-level rich text with instructions, duration, and notes | [built] |
| Protocol versioning (version field, updatedAt tracking) | [built] |
| Protocol list with search and filtering | [built] |
| Run Mode: launch a locked run from a protocol | [in progress] |
| Run Mode: step-by-step execution view with live timers | [in progress] |
| Run Mode: inline per-step annotations and deviation notes | [in progress] |
| Run records linked to source protocol and operator | [built] |
| Active Runs view (in-progress runs accessible from nav) | [built] |
| PDF export of protocol | [planned] |
| Reagent library integration and auto-generated materials list | [planned] |

### 3.3 Equipment

Shared equipment booking with multi-user visibility and conflict detection.

| Feature | Status |
|---------|--------|
| Equipment calendar — daily and weekly views | [built] |
| Resource groups: TC Rooms, FPLC/HPLC, SPR, OTHER | [built] |
| New booking modal with 30-min select dropdowns | [built] |
| Overnight booking support | [built] |
| Client + server-side validation (end > start, ≤24 h max) | [built] |
| Conflict detection with concurrent-booking confirmation | [built] |
| Per-equipment default durations (config-driven) | [built] |
| "End Early" button on active bookings | [built] |
| Early-release toast notifications via 30 s polling | [built] |
| Equipment ↗ link from Dashboard widget to full Equipment page | [built] |
| Today button always visible; resets scroll to default time window | [built] |
| Arrow navigation with timezone-safe date parsing | [built] |

### 3.4 Data Ingestion

Structured entry creation for typed scientific records.

| Feature | Status |
|---------|--------|
| 8 entry types: General, Experiment, Protocol, Note, Cell Line, Protein, Reagent, Chromatography Run | [built] |
| Type-specific structured fields (required + optional, config-driven) | [built] |
| Free-text body with rich text editor | [built] |
| Custom key-value fields (arbitrary additional metadata per entry) | [built] |
| File attachments: drag-and-drop upload for images, PDFs, spreadsheets | [built] |
| Inline attachment preview | [built] |
| CSV trace upload for chromatography runs (A280 trace) | [built] |
| Entry versioning (version field incremented on save) | [built] |
| Tag system (many-to-many, reusable across entries) | [built] |
| Link an entry to a protocol run | [built] |

### 3.5 Inventory

Lightweight catalog of lab materials, organized by category.

| Feature | Status |
|---------|--------|
| Reagents catalog page | [in progress] |
| Cell lines catalog page | [in progress] |
| Plasmids catalog page | [in progress] |
| Stocks catalog page | [in progress] |
| Search and filter within each category | [planned] |
| Link inventory items to entries and runs | [planned] |
| CSV import for bulk population | [planned] |
| Low-stock alerts | [planned] |

### 3.6 Knowledge Hub

Structured repository for lab reference materials.

| Feature | Status |
|---------|--------|
| Section pages: Lab Resources, Papers & Grants, Safety & SDS, Meeting Notes, Codes & Scripts | [built] |
| Admin section for hub management | [built] |

### 3.7 Search

| Feature | Status |
|---------|--------|
| Global search bar (⌘+K) spanning all domains | [planned] |
| PostgreSQL ILIKE across JSONB typedData and text fields | [planned] |
| Filter by entry type, date range, author, tags | [planned] |
| Result snippets with keyword highlighting | [planned] |

### 3.8 Authentication

| Feature | Status |
|---------|--------|
| Operator name as free-text field (no login required currently) | [built] |
| NextAuth.js with email/password login | [planned] |
| Role-based access control (Admin / Member) | [planned] |
| Institutional SSO (SAML/OAuth) | [planned] |

---

## 4. Data Model

The actual Prisma/PostgreSQL schema as of current development. Field names match the Prisma schema exactly.

### User

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | Auto-generated |
| email | text (unique) | |
| name | text (nullable) | |
| role | text | Default: "MEMBER" |
| createdAt | timestamp | Auto |

Relations: has many `Entry` (as author); has many `ProtocolRun` (as runner).

---

### Entry

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| title | text | |
| description | text | Default: "" |
| technique | text | Default: "General" |
| entryType | enum | GENERAL \| EXPERIMENT \| PROTOCOL \| NOTE \| CELL\_LINE \| PROTEIN \| REAGENT \| CHROMATOGRAPHY\_RUN |
| typedData | jsonb | Type-specific structured fields + custom key-value pairs. Shape: `{ typed: Record<string,string>, custom: {id,key,value}[] }` |
| body | text | Rich text content (HTML or Markdown) |
| createdAt | timestamp | Auto |
| updatedAt | timestamp | Auto-updated on every save |
| version | integer | Default: 1; incremented on each save |
| authorId | uuid → User | Nullable |
| linkedRunId | uuid → ProtocolRun | Nullable; links an entry to a run result |

Relations: many-to-many `Tag`; has many `Attachment`; has many `ProtocolRun` (as source protocol).

---

### Attachment

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| entryId | uuid → Entry | |
| filename | text | Original filename |
| mime | text | MIME type (e.g. "image/png") |
| size | integer | Bytes |
| path | text | Path under local `/uploads` directory |
| checksum | text (nullable) | |
| createdAt | timestamp | Auto |

---

### Tag

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| name | text (unique) | |

Relations: many-to-many `Entry` via implicit join table `_EntryTags`.

---

### ProtocolRun

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| title | text | |
| status | text | Default: "IN\_PROGRESS" |
| locked | boolean | Default: true — prevents editing source during run |
| runBody | text | Snapshot of protocol body at run start |
| notes | text | Default: "" |
| interactionState | jsonb | Step completion state, timer values, per-step notes |
| createdAt | timestamp | Auto |
| updatedAt | timestamp | Auto |
| sourceEntryId | uuid → Entry | The protocol entry this run was cloned from |
| runnerId | uuid → User | Nullable |

Relations: has many `Entry` (as linked run results).

---

### TodoHistory

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| userId | text | Client-side user identifier |
| userName | text | Display name |
| date | text | YYYY-MM-DD — the calendar day this list belonged to |
| items | jsonb | Full `TodoItem[]` snapshot at time of day rollover |
| createdAt | timestamp | Auto |

---

### EquipmentBooking

| Field | Type | Notes |
|-------|------|-------|
| id | uuid (PK) | |
| equipmentId | text | Resource ID (e.g. "akta1", "spr-t200") |
| operatorName | text | Free-text operator name |
| userId | text | Client-side user identifier |
| title | text | Default: "" |
| startTime | timestamp | Booking start (full ISO datetime) |
| endTime | timestamp | Booking end (full ISO datetime) |
| endedEarlyAt | timestamp (nullable) | Set when "End Early" is triggered; used for toast polling |
| createdAt | timestamp | Auto |

Index: `(equipmentId, startTime, endTime)` for fast overlap queries.

---

## 5. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Framework** | Next.js (App Router), TypeScript | Full-stack React. Server components for fast page loads. API routes for all backend logic. |
| **Styling** | Tailwind CSS | Utility-first. No component library — all components are custom. Dark theme throughout. |
| **ORM** | Prisma | Type-safe schema-first migrations. Prisma Client auto-generated from schema. |
| **Database** | PostgreSQL | Docker Compose in development; Railway in production. |
| **Package manager** | pnpm | Fast installs, disk-efficient. |
| **Deployment** | Railway | PostgreSQL + Next.js app hosted together on Railway. |
| **Auth** | Not yet implemented | Operator name is a free-text field. NextAuth.js planned for email/password login. |
| **File storage** | Local `/uploads` directory | Served via Next.js API route. Cloud migration (S3 / Cloudflare R2) planned for production scale. |
| **Search** | PostgreSQL ILIKE | Across JSONB `typedData` fields and text columns. Upgrade path to Typesense if needed at scale. |
| **Drag-and-drop** | @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities | ToDo list reordering and drop-to-schedule on the Dashboard. |

---

## 6. UI/UX Principles

### Core Principles as UX Rules

1. **Dashboard-first.** The home route (`/`) renders the Dashboard. All primary work surfaces — the daily schedule, ToDo list, equipment calendar — are immediately visible on load. Navigation links lead to supporting areas; they do not replace the Dashboard as the primary surface.

2. **Reproducibility through structure.** Every data-entry form offers a typed mode with fields appropriate to the record type. Free text is always available as a complement, never as the sole option. Protocol runs lock the source protocol to preserve the exact version that was executed.

3. **Everything is searchable.** Every model is designed with search in mind. Text fields are ILIKE-queryable. JSONB `typedData` fields are searched across all keys. The ⌘+K search bar is the primary navigation for users who know what they're looking for.

### Additional UX Rules

- **Desktop-first.** Mobile UI is deferred. Primary use case: documentation at a desk workstation or near-bench terminal.
- **Dark theme throughout.** Zinc/slate color palette. Accent colors: indigo (primary actions), emerald (protocols), purple (equipment), amber (ingestion/warnings).
- **Time format:** `9:00 am` / `9:30 am` — lowercase am/pm, always include minutes. 30-minute granularity in all time pickers and calendar grids.
- **Equipment categories:** TC Rooms | FPLC/HPLC | SPR | OTHER. Per-equipment default booking durations are config-driven (`src/config/equipmentDefaults.ts`).
- **Navigation:** Top bar contains **Home, Equipment, 👾 Ingestion, Active Runs** only. All other pages (Protocols, Inventory, Knowledge Hub, Entries) are reached via Dashboard boxes or in-app links. Navigation should feel flat, not hierarchical.
- **No compliance theater.** No e-signatures, no witness fields, no 21 CFR Part 11. Auto-timestamps and version history are sufficient auditability for an academic lab.
- **Toast notifications** for multi-user events (e.g., equipment early release). Auto-dismiss after 8 s, always manually dismissible.

---

## 7. Roadmap

### Near-Term (Active Development)

| Feature | Description |
|---------|-------------|
| **Run Mode** | Step-focused execution view for protocols. Live timers per step, inline deviation notes, per-step completion checkboxes. Run records link back to the source protocol version and operator. |
| **Reagent library integration** | Structured reagent records linked to protocol steps. Auto-generated materials list from a protocol's linked reagents. |
| **.eln export** | Export entries and run records in ELN Consortium / RO-Crate format for interoperability with other ELN systems. |
| **Authentication** | NextAuth.js with email/password. Replace free-text operator field with real authenticated user sessions. Role-based access: Admin (PI, lab manager) and Member. |

### Phase 2 (Post-Adoption)

| Feature | Description |
|---------|-------------|
| **Mobile/iPad UI** | Responsive layout for protocol execution at the bench on a tablet. |
| **Cloud file storage** | Migrate `/uploads` to S3 or Cloudflare R2. Presigned URLs for direct client uploads. |
| **MS proximity labeling RAG tool** | Retrieval-augmented generation over TurboID proximity labeling datasets — a potential ELN-native analysis feature. |
| **Sample barcoding** | Generate and print QR codes for tubes, boxes, and plates. Scan to retrieve sample info and linked experiments. |
| **Instrument integration** | Connect to ÄKTA UNICORN, plate reader software, and other instrument outputs. Auto-import chromatography traces and raw data files. |
| **External structural data references** | Structured links to cryoSPARC session IDs, PDB accession codes, synchrotron beamline logs — metadata and links only, never raw files. |
| **Advanced inventory** | Stock auto-decrement on run consumption. Purchase order tracking. Vendor catalog integration. |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Low adoption** — team sticks with paper/Google Docs | High | Critical | Build protocols for standalone PDF value first: a well-formatted PDF export is useful even without the ELN. Run Mode becomes a natural upgrade once protocols are already being written — the "trojan horse" strategy. Dashboard-first design and quick todo entry minimize friction for daily use. PI buy-in via dashboard that surfaces lab activity at a glance. |
| **Data loss** | Low | Critical | Auto-save on every edit. Version history via `version` field on Entry. PostgreSQL on Railway includes automated backups. Local `/uploads` directory should be backed up separately until cloud storage is implemented. |
| **Feature creep** | High | Medium | Strict near-term / Phase 2 boundary. Ship Run Mode and authentication before expanding scope. Collect team feedback for 4–6 weeks before committing to Phase 2 features. |
| **Storage growth** | Medium | Low | 50 MB per-file limit enforced server-side. Client-side image compression on upload. Explicit exclusion of large structural data files (.mrc, .star, etc.). |
| **Search performance degrades** | Low | Medium | PostgreSQL ILIKE with proper indexing is performant to ~100K rows. If the lab generates more, migrate to Typesense. |
| **Editor complexity** | Medium | Medium | Rich text editor is scoped to Ingestion and Protocol surfaces. Start with a stable, well-documented ProseMirror-based editor. Add custom extensions incrementally. |

---

## 9. File & Attachment Policy

Since this ELN serves a structural biology lab, it's important to be explicit about what belongs in the app and what doesn't.

### Stored in the ELN
- Gel images (SDS-PAGE, Western blot, Coomassie) — PNG, JPEG, TIFF
- Chromatography traces (SEC, ion exchange) — exported as PNG/PDF/CSV from UNICORN or similar
- Plate reader data — exported CSV or Excel files
- Crystallization drop images — JPEG/PNG from imaging systems
- Cloning maps and sequence files — small files (.gb, .fasta, .ab1), ≤50 MB
- PDFs (papers, vendor spec sheets, protocols)
- Spreadsheets (.xlsx, .csv) for experimental conditions, quantifications
- Presentation slides or figures relevant to an experiment

### NOT stored in the ELN
- Raw cryo-EM data (micrographs, movies, .mrc, .mrcs files) — managed in **cryoSPARC**
- Particle stacks, reconstructed volumes, half-maps
- RELION job directories
- Synchrotron diffraction data (.img, .cbf, .h5 files) — managed in beamline pipelines
- Processed structure files (.mtz, .pdb refinement intermediates) — stored in institutional servers
- Any single file >50 MB

For structural data, the ELN entry should contain **processing notes, parameters, and links** (e.g., "cryoSPARC job J42, 3.2 Å resolution, C1 symmetry") rather than the data itself. This keeps the app lightweight and avoids duplicating data that already lives in purpose-built systems.

---

## 10. Getting Started

```bash
# Clone the repo
git clone https://github.com/tyoung-4/myfirst-eln.git
cd myfirst-eln

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Fill in DATABASE_URL for local PostgreSQL

# Start PostgreSQL (Docker)
docker-compose -f docker-compose.dev.yml up -d

# Apply migrations and generate Prisma client
npx prisma migrate deploy
npx prisma generate

# Start the development server
pnpm dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/eln
```

Only `DATABASE_URL` is required. There are no third-party auth or storage service keys.

---

## 11. Contributing

This project is maintained by the Williams Lab.

### Branch Conventions

- Branch before every feature or fix: `git checkout -b feature/[name]` or `git checkout -b chore/[name]`
- Merge branches sequentially into `main`. Avoid long-lived divergent branches.

### Database / Prisma

- Prisma migrations are always **additive** — never reset or drop tables in production.
- After every schema change: `npx prisma migrate dev --name [descriptive-name]` then `npx prisma generate`.
- Never run `prisma migrate reset` against the production database.

### Spec

- `spec.md` should be updated whenever a major feature is completed, a design decision changes, or a new area of the system is built out. Keep it in sync with the actual implementation.

### Code Conventions

- TypeScript strict mode throughout.
- All config (entry types, equipment defaults) lives in `src/config/` or `src/lib/` as a single source of truth — edit the config file to add new types or resources, not ad-hoc in components.
- Tailwind utility classes only — no inline `style` objects except for dynamic pixel values (e.g. absolute-positioned grid items in the calendar).

---

## License

MIT — see [LICENSE](./LICENSE) for details.
