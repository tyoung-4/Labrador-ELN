# Entry Type System

This document describes the typed entry system used in the JCW Lab ELN and explains how to add new entry types in the future.

---

## Overview

Every entry has an `entryType` field (stored as a PostgreSQL enum) and a `typedData` field (stored as JSONB). Together these let each entry carry a small set of structured, type-specific fields **plus** unlimited user-defined custom key-value pairs — all without requiring a schema change when you add a new type.

**Current entry types:**

| Type | Icon | Purpose |
|------|------|---------|
| `GENERAL` | 📄 | Catch-all for anything that doesn't fit another type |
| `EXPERIMENT` | 🔬 | Lab experiments with hypothesis, outcome, and status tracking |
| `PROTOCOL` | 📋 | Standard operating procedures and reproducible methods |
| `NOTE` | 📝 | Observations, ideas, meeting notes, and other records |

---

## Data Model

### Prisma fields on `Entry`

```prisma
entryType  EntryType  @default(GENERAL)   // enum
typedData  Json       @default("{}")      // JSONB — see shape below
```

### `typedData` JSON shape

```json
{
  "typed": {
    "projectName": "TurboID proximity labeling",
    "status": "in-progress"
  },
  "custom": [
    { "id": "uuid", "key": "Sample ID",    "value": "BL21-42" },
    { "id": "uuid", "key": "Gel run date", "value": "2025-03-01" }
  ]
}
```

- **`typed`** — structured fields defined by the entry type config (see below).
- **`custom`** — user-defined key-value pairs. Can be added by anyone at any time without schema changes.

---

## How to Add a New Entry Type

Adding a new type requires **two changes only** — no API rewrite, no UI rewrite.

### Step 1 — Add it to `src/lib/entryTypes.ts`

Open `src/lib/entryTypes.ts` and add a new key to `ENTRY_TYPE_CONFIGS`:

```typescript
CRYSTALLOGRAPHY: {
  label: "Crystallography",
  icon: "💎",
  description: "Crystal growth and diffraction experiments.",
  fields: [
    { key: "protein",     label: "Protein / Target",  type: "text",
      placeholder: "e.g. KRAS G12C" },
    { key: "condition",   label: "Crystal Condition",  type: "text",
      placeholder: "e.g. 0.2 M NaCl, 20% PEG 3350" },
    { key: "resolution",  label: "Resolution (Å)",     type: "text",
      placeholder: "e.g. 2.1" },
    { key: "spaceGroup",  label: "Space Group",        type: "text",
      placeholder: "e.g. P 21 21 21" },
    { key: "outcome",     label: "Outcome",            type: "select",
      options: ["growing", "diffracts", "failed", "solved"] },
  ],
},
```

**`FieldDef` schema:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `key` | `string` | ✓ | Camel-case identifier stored in `typedData.typed` |
| `label` | `string` | ✓ | Human-readable label shown in the UI |
| `type` | `"text" \| "textarea" \| "select"` | ✓ | Input widget type |
| `placeholder` | `string` | — | Hint text shown in text/textarea inputs |
| `options` | `string[]` | select only | Options for a select input |

### Step 2 — Add the enum value to `prisma/schema.prisma`

```prisma
enum EntryType {
  GENERAL
  EXPERIMENT
  PROTOCOL
  NOTE
  CRYSTALLOGRAPHY   // ← add here
}
```

Then run:

```bash
npx prisma migrate dev --name add-crystallography-type
```

### That's it

- The entry type dropdown in the editor will automatically include the new type.
- The typed fields panel will render the new fields automatically.
- No changes needed to the API routes or the main entry list page.

---

## File Attachments

Attachments are stored in the `Attachment` table (already in the schema) and the actual files are saved under `public/uploads/{entryId}/` so Next.js serves them as static assets.

**API:**

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/entries/{id}/attachments` | List attachments for an entry |
| `POST` | `/api/entries/{id}/attachments` | Upload a file (`multipart/form-data`, field `file`) |
| `DELETE` | `/api/entries/{id}/attachments/{attachmentId}` | Delete an attachment |

Attachments appear in the editor only after the entry has been saved (the entry needs an `id` to associate files with it).

**Future migration to cloud storage:** swap `public/uploads/` writes in `src/app/api/entries/[id]/attachments/route.ts` with S3/GCS/R2 uploads. The DB schema and UI do not need to change.

---

## Design Principles

- **One config file** (`src/lib/entryTypes.ts`) drives the editor UI, the API validation, and (with Prisma) the database enum.
- **Open/closed** — adding a new type extends the system rather than modifying existing logic.
- **Backwards compatible** — all existing entries default to `GENERAL` with `typedData = {}`. Nothing breaks.
- **Progressive** — every entry always has a free-text `body` field (TipTap rich-text editor). Typed fields add structure on top; custom fields add anything else.
