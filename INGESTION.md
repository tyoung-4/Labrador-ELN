# Data Ingestion

The **Data Ingestion** system (`/ingestion`) is the central hub for recording and organizing experimental data in structured or free-form entries.

---

## Two Entry Flows

### 1. Ingest Data (Typed Entry)

Click **👾 Ingest Data** to launch the guided flow.

**Step 1 — Is this experimental data?**
- **Yes — link to a run**: Browse Active or Completed protocol runs and select one to link this entry to.
- **No — standalone entry**: Skip run linking and proceed directly to type selection.

**Step 2 — Select Entry Type**
Choose one of 8 structured types (see below). Each type has its own set of predefined fields.

**Step 3 — Fill in the entry form**
- **Core fields** — type-specific required and optional fields (text, date, select, textarea)
- **Structured Data section** — secondary fields including special types like CSV trace uploads
- **Notes** — free-text body for additional observations
- **Attachments** — upload any files (images, PDFs, raw data)
- **Custom Fields** — add arbitrary key-value pairs for data that doesn't fit the schema
- **Save** — entry is created in the database with optional run link

---

### 2. Free Entry

Click **✏️ Free Entry** for unstructured records.

- **Title** (required)
- **Tags** — comma-separated labels
- **Body** — free-form text
- **Attachments** — file uploads
- **Link to Run** — optionally associate with a protocol run

Saved as a `GENERAL` entry with `typedData._isUnstructured = "true"` and `typedData._tags` for filtering.

---

## Entry Types

| Type | Icon | Key Fields |
|------|------|------------|
| `GENERAL` | 📄 | Title, body only |
| `EXPERIMENT` | 🔬 | Project name, hypothesis, outcome, status |
| `PROTOCOL` | 📋 | Version, estimated duration, materials list |
| `NOTE` | 📝 | Category (observation / idea / meeting / other) |
| `CELL_LINE` | 🧫 | Cell line name, species, source, passage number, date, culture conditions |
| `PROTEIN` | 🧬 | Protein name, organism, tag, construct, expression system, yield |
| `REAGENT` | 🧪 | Reagent name, supplier, catalog number, concentration, date received, storage, lot number |
| `CHROMATOGRAPHY_RUN` | 📈 | Protein name, column type, date, operator, yield, A280 trace (CSV) |

### A280 Trace (CSV)
The `CHROMATOGRAPHY_RUN` type includes a **CSV trace upload** field. Upload a CSV file with two columns:
```
volume_mL,abs280
0.0,0.012
0.5,0.041
...
```
The parsed data is displayed as an HTML table (no charting library) and stored as JSON in `typedData.typed.a280Trace`.

---

## Entry List

The `/ingestion` list view shows all entries with:
- **Type badge** (color-coded by type)
- **Linked run** (clickable → `/runs/[id]`)
- **Date** and **Operator**
- **Search** by title, description, or author name
- **Type filter** dropdown

---

## Data Storage

- All entries are stored in the **PostgreSQL database** via Prisma (`Entry` model)
- Structured fields are stored in `Entry.typedData` (JSONB) as `{ typed: {…}, custom: [{id, key, value}] }`
- Files are stored **locally** on disk at `public/uploads/{entryId}/` and served as static files
- No charting libraries — traces are rendered as HTML tables
- Run links use a nullable FK: `Entry.linkedRunId → ProtocolRun.id` (relation name `"RunLink"`)

---

## How to Add a New Entry Type

1. **Add the enum value** to `prisma/schema.prisma` → `EntryType` enum
2. **Run migration**: `pnpm prisma migrate dev --name add_<type>`
3. **Add the config** to `src/lib/entryTypes.ts` → `ENTRY_TYPE_CONFIGS`:
   ```typescript
   MY_TYPE: {
     label: "My Type",
     icon: "🔭",
     description: "What this type is for.",
     fields: [
       { key: "myField", label: "My Field", type: "text", required: true },
       { key: "notes",   label: "Notes",    type: "textarea", section: "structured" },
     ],
   },
   ```
4. **Add a badge color** in `src/app/ingestion/page.tsx` → `TYPE_BADGE` record
5. That's it — the UI, API validation, and entry form all derive from the config automatically.

### Field Types

| `type` | Renders as |
|--------|-----------|
| `"text"` | `<input type="text">` |
| `"textarea"` | `<textarea>` |
| `"select"` | `<select>` with `options` array |
| `"date"` | `<input type="date">` |
| `"csv_trace"` | File picker + HTML table preview; stored as JSON |

### Field Options

| Property | Description |
|----------|-------------|
| `required` | Validated before save; form shows `*` indicator |
| `section: "core"` | Shown in main fields block (default) |
| `section: "structured"` | Shown below the "Structured Data" separator |
| `placeholder` | Input placeholder text |
| `options` | Array of strings for `"select"` type |
