/**
 * Inventory template definitions and Excel generation utility.
 * All template types, canonical column names, and SheetJS workbook generation live here.
 */

export type TemplateField = {
  column: string;        // canonical header — never changes
  label: string;         // human-readable column header in the file
  required: boolean;
  description: string;   // shown on Instructions sheet
  exampleValue: string;  // shown as gray example row
  allowedValues?: string[];
};

export type TemplateConfig = {
  type: TemplateType;
  displayName: string;
  filename: string;
  icon: string;
  description: string;
  fields: TemplateField[];
};

export type TemplateType =
  | "protein_stock"
  | "antibody"
  | "clinical_antibody"
  | "general_reagent"
  | "cell_line"
  | "plasmid";

// ── Template definitions ────────────────────────────────────────────────────

const PROTEIN_STOCK: TemplateConfig = {
  type: "protein_stock",
  displayName: "Protein Stock",
  filename: "protein_stock_template.xlsx",
  icon: "🧪",
  description: "Purified proteins — concentration, volume, and expression details",
  fields: [
    { column: "name", label: "Name *", required: true, description: "Protein name or construct identifier", exampleValue: "His6-EGFP" },
    { column: "concentration_mg_ml", label: "Concentration (mg/mL) *", required: true, description: "Protein concentration in mg/mL", exampleValue: "2.5" },
    { column: "total_volume_ml", label: "Total Volume (mL) *", required: true, description: "Total volume of this stock", exampleValue: "1.0" },
    { column: "owner", label: "Owner *", required: true, description: "Person responsible for this stock", exampleValue: "Alice" },
    { column: "date_made", label: "Date Made *", required: true, description: "Date the stock was purified (YYYY-MM-DD)", exampleValue: "2024-03-15" },
    { column: "location", label: "Location *", required: true, description: "Storage location (freezer, box, position)", exampleValue: "-80°C Box 3, A1" },
    { column: "expression_system", label: "Expression System", required: false, description: "Host used for protein expression", exampleValue: "Bacterial", allowedValues: ["Bacterial", "Mammalian", "Insect", "Cell-free"] },
    { column: "iptg_mM", label: "IPTG (mM)", required: false, description: "IPTG concentration used for induction", exampleValue: "0.5" },
    { column: "induction_temp_C", label: "Induction Temp (°C)", required: false, description: "Temperature during induction", exampleValue: "18" },
    { column: "induction_duration", label: "Induction Duration", required: false, description: "How long induction was run", exampleValue: "Overnight", allowedValues: ["4hr", "Overnight", "Custom"] },
    { column: "purification_method", label: "Purification Method", required: false, description: "e.g., Ni-NTA, SEC, Ion Exchange", exampleValue: "Ni-NTA + SEC" },
    { column: "purity_percent", label: "Purity (%)", required: false, description: "Estimated purity from gel/HPLC", exampleValue: "95" },
    { column: "storage_buffer", label: "Storage Buffer", required: false, description: "Buffer composition for storage", exampleValue: "50mM HEPES pH 7.5, 150mM NaCl, 10% glycerol" },
    { column: "linked_run_id", label: "Linked Run ID", required: false, description: "Protocol run ID this stock originated from", exampleValue: "RUN-0042" },
    { column: "notes", label: "Notes", required: false, description: "Any additional notes", exampleValue: "Aliquoted 100 µL each" },
  ],
};

const ANTIBODY: TemplateConfig = {
  type: "antibody",
  displayName: "Antibody",
  filename: "antibody_template.xlsx",
  icon: "🔬",
  description: "FACS, primary, secondary, and HRP-conjugated antibodies",
  fields: [
    { column: "name", label: "Name *", required: true, description: "Antibody name or clone identifier", exampleValue: "anti-CD3 PE" },
    { column: "subtype", label: "Subtype *", required: true, description: "Antibody category", exampleValue: "FACS", allowedValues: ["FACS", "Primary", "HRP-Conjugate", "Secondary", "Other"] },
    { column: "target", label: "Target *", required: true, description: "Antigen or target molecule", exampleValue: "CD3" },
    { column: "host", label: "Host *", required: true, description: "Host species the antibody was raised in", exampleValue: "Mouse" },
    { column: "catalog_number", label: "Catalog Number *", required: true, description: "Vendor catalog number", exampleValue: "555336" },
    { column: "vendor", label: "Vendor *", required: true, description: "Vendor or supplier name", exampleValue: "BD Biosciences" },
    { column: "owner", label: "Owner *", required: true, description: "Person responsible for this stock", exampleValue: "Bob" },
    { column: "date_received", label: "Date Received *", required: true, description: "Date the antibody arrived (YYYY-MM-DD)", exampleValue: "2024-02-10" },
    { column: "location", label: "Location *", required: true, description: "Storage location", exampleValue: "4°C Fridge, Antibody Box A" },
    { column: "lot_number", label: "Lot Number", required: false, description: "Vendor lot or batch number", exampleValue: "BH3456789" },
    { column: "concentration_mg_ml", label: "Concentration (mg/mL)", required: false, description: "Antibody concentration if known", exampleValue: "0.5" },
    { column: "vol_per_aliquot_ul", label: "Volume/Aliquot (µL)", required: false, description: "Volume of each aliquot", exampleValue: "100" },
    { column: "num_aliquots", label: "# Aliquots", required: false, description: "Number of aliquots made", exampleValue: "5" },
    { column: "expiration_date", label: "Expiration Date", required: false, description: "Manufacturer expiration date (YYYY-MM-DD)", exampleValue: "2026-01-01" },
    { column: "clone", label: "Clone", required: false, description: "Clone name if applicable", exampleValue: "UCHT1" },
    { column: "fluorophore", label: "Fluorophore", required: false, description: "Fluorophore conjugate (FACS only)", exampleValue: "PE" },
    { column: "application", label: "Application", required: false, description: "Intended application (Primary/HRP)", exampleValue: "WB, IHC" },
    { column: "dilution_factor", label: "Dilution Factor", required: false, description: "Working dilution (Primary/HRP)", exampleValue: "1:1000" },
    { column: "conjugate_type", label: "Conjugate Type", required: false, description: "Type of conjugate (HRP only)", exampleValue: "HRP" },
    { column: "notes", label: "Notes", required: false, description: "Any additional notes", exampleValue: "Works well for flow" },
  ],
};

const CLINICAL_ANTIBODY: TemplateConfig = {
  type: "clinical_antibody",
  displayName: "Clinical Antibody",
  filename: "clinical_antibody_template.xlsx",
  icon: "💉",
  description: "Clinical-grade antibodies and biologics",
  fields: [
    { column: "name", label: "Name *", required: true, description: "Drug name or INN", exampleValue: "Pembrolizumab" },
    { column: "target", label: "Target *", required: true, description: "Molecular target", exampleValue: "PD-1" },
    { column: "concentration_mg_ml", label: "Concentration (mg/mL) *", required: true, description: "Concentration of this stock", exampleValue: "25" },
    { column: "total_volume_ml", label: "Total Volume (mL) *", required: true, description: "Total volume of this stock", exampleValue: "4.0" },
    { column: "owner", label: "Owner *", required: true, description: "Person responsible for this stock", exampleValue: "Carol" },
    { column: "date_received", label: "Date Received *", required: true, description: "Date received (YYYY-MM-DD)", exampleValue: "2024-01-20" },
    { column: "location", label: "Location *", required: true, description: "Storage location", exampleValue: "4°C Clinical Fridge" },
    { column: "clinical_lot_number", label: "Clinical Lot Number", required: false, description: "Clinical/GMP lot number", exampleValue: "CL-2024-001" },
    { column: "storage_condition", label: "Storage Condition", required: false, description: "Required storage conditions", exampleValue: "2-8°C, protect from light" },
    { column: "originating_institution", label: "Originating Institution", required: false, description: "Source institution or trial", exampleValue: "Mass General Hospital" },
    { column: "notes", label: "Notes", required: false, description: "Any additional notes", exampleValue: "Clinical trial use only" },
  ],
};

const GENERAL_REAGENT: TemplateConfig = {
  type: "general_reagent",
  displayName: "General Reagent",
  filename: "general_reagent_template.xlsx",
  icon: "🧴",
  description: "Chemicals, kits, buffers, and lab consumables",
  fields: [
    { column: "name", label: "Name *", required: true, description: "Reagent or kit name", exampleValue: "Pierce BCA Protein Assay Kit" },
    { column: "owner", label: "Owner *", required: true, description: "Person responsible", exampleValue: "Dave" },
    { column: "location", label: "Location *", required: true, description: "Storage location", exampleValue: "RT Cabinet 2, Shelf 3" },
    { column: "vendor", label: "Vendor", required: false, description: "Vendor or supplier", exampleValue: "Thermo Fisher" },
    { column: "catalog_number", label: "Catalog Number", required: false, description: "Vendor catalog number", exampleValue: "23225" },
    { column: "quantity", label: "Quantity", required: false, description: "Amount remaining", exampleValue: "2" },
    { column: "unit", label: "Unit", required: false, description: "Unit for quantity (e.g. kit, mL, mg)", exampleValue: "kit" },
    { column: "expiration_date", label: "Expiration Date", required: false, description: "Expiration date (YYYY-MM-DD)", exampleValue: "2025-12-31" },
    { column: "notes", label: "Notes", required: false, description: "Any additional notes", exampleValue: "2 kits remaining" },
  ],
};

const CELL_LINE: TemplateConfig = {
  type: "cell_line",
  displayName: "Cell Line",
  filename: "cell_line_template.xlsx",
  icon: "🦠",
  description: "Cell lines with vial and passage tracking",
  fields: [
    { column: "name", label: "Name *", required: true, description: "Cell line name", exampleValue: "HEK293T" },
    { column: "passage_at_freeze", label: "Passage at Freeze *", required: true, description: "Passage number when frozen", exampleValue: "12" },
    { column: "cells_per_vial", label: "Cells/Vial *", required: true, description: "Number of cells per vial (×10⁶)", exampleValue: "5" },
    { column: "vial_count", label: "# Vials *", required: true, description: "Total number of vials frozen", exampleValue: "10" },
    { column: "owner", label: "Owner *", required: true, description: "Person responsible", exampleValue: "Eve" },
    { column: "date_frozen", label: "Date Frozen *", required: true, description: "Date vials were frozen (YYYY-MM-DD)", exampleValue: "2024-03-01" },
    { column: "location", label: "Location *", required: true, description: "Storage location (LN2 tank, box, position)", exampleValue: "LN2 Tank 1, Box 4, A3" },
    { column: "tube_code", label: "Tube Code", required: false, description: "Internal tube identifier", exampleValue: "TC-2024-042" },
    { column: "source", label: "Source", required: false, description: "Where the cell line came from", exampleValue: "ATCC CRL-3216" },
    { column: "medium", label: "Medium", required: false, description: "Growth medium used", exampleValue: "DMEM + 10% FBS" },
    { column: "mycoplasma_test_date", label: "Mycoplasma Test Date", required: false, description: "Date of last mycoplasma test (YYYY-MM-DD)", exampleValue: "2024-02-15" },
    { column: "authentication_date", label: "Authentication Date", required: false, description: "Date of last STR profiling (YYYY-MM-DD)", exampleValue: "2023-11-01" },
    { column: "notes", label: "Notes", required: false, description: "Any additional notes", exampleValue: "High passage — use only for initial experiments" },
  ],
};

const PLASMID: TemplateConfig = {
  type: "plasmid",
  displayName: "Plasmid",
  filename: "plasmid_template.xlsx",
  icon: "🧬",
  description: "Plasmids and constructs with sequence and resistance info",
  fields: [
    { column: "name", label: "Name *", required: true, description: "Plasmid name or construct ID", exampleValue: "pET-28a-His6-EGFP" },
    { column: "backbone", label: "Backbone *", required: true, description: "Vector backbone", exampleValue: "pET-28a" },
    { column: "resistance_marker", label: "Resistance Marker *", required: true, description: "Antibiotic resistance selection marker", exampleValue: "Kanamycin" },
    { column: "owner", label: "Owner *", required: true, description: "Person responsible", exampleValue: "Frank" },
    { column: "date_made", label: "Date Made *", required: true, description: "Date the plasmid was made (YYYY-MM-DD)", exampleValue: "2024-01-10" },
    { column: "location", label: "Location *", required: true, description: "Storage location", exampleValue: "-20°C Box 1, B2" },
    { column: "insert_gene", label: "Insert Gene", required: false, description: "Gene or insert being expressed", exampleValue: "EGFP" },
    { column: "bacterial_strain", label: "Bacterial Strain", required: false, description: "E. coli strain for propagation", exampleValue: "DH5α" },
    { column: "concentration_ng_ul", label: "Concentration (ng/µL)", required: false, description: "DNA concentration", exampleValue: "250" },
    { column: "volume_ul", label: "Volume (µL)", required: false, description: "Volume of stock", exampleValue: "100" },
    { column: "sequence_file_name", label: "Sequence File", required: false, description: "Name of sequence file (.gb, .fasta, etc.)", exampleValue: "pET28a_EGFP.gb" },
    { column: "notes", label: "Notes", required: false, description: "Any additional notes", exampleValue: "Verified by Sanger sequencing" },
  ],
};

export const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  protein_stock: PROTEIN_STOCK,
  antibody: ANTIBODY,
  clinical_antibody: CLINICAL_ANTIBODY,
  general_reagent: GENERAL_REAGENT,
  cell_line: CELL_LINE,
  plasmid: PLASMID,
};

export const TEMPLATE_TYPES_ORDERED: TemplateType[] = [
  "protein_stock",
  "antibody",
  "clinical_antibody",
  "general_reagent",
  "cell_line",
  "plasmid",
];

// ── Excel generation ────────────────────────────────────────────────────────

/** Generates a SheetJS workbook for the given template type. Client-side only. */
export async function generateTemplate(type: TemplateType): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const config = TEMPLATE_CONFIGS[type];

  // ── Sheet 1: Data ──────────────────────────────────────────────────────
  const headers = config.fields.map((f) =>
    f.required ? `${f.label}` : f.label
  );
  const exampleRow = config.fields.map((f) => f.exampleValue);

  // 50 blank data rows
  const blankRows: string[][] = Array.from({ length: 50 }, () =>
    Array(config.fields.length).fill("")
  );

  const dataSheetData = [headers, exampleRow, ...blankRows];
  const dataSheet = XLSX.utils.aoa_to_sheet(dataSheetData);

  // Freeze top row
  dataSheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Column widths — max of header length and example length, min 15
  dataSheet["!cols"] = config.fields.map((f) => ({
    wch: Math.max(15, f.label.length + 2, f.exampleValue.length + 2),
  }));

  // Cell styles — header row: dark bg + white bold text
  // Example row: light gray fill + italic
  config.fields.forEach((_, colIdx) => {
    const headerCell = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    const exampleCell = XLSX.utils.encode_cell({ r: 1, c: colIdx });

    if (dataSheet[headerCell]) {
      dataSheet[headerCell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E293B" } }, // zinc-800
        alignment: { wrapText: false },
      };
    }
    if (dataSheet[exampleCell]) {
      dataSheet[exampleCell].s = {
        font: { italic: true, color: { rgb: "94A3B8" } }, // zinc-400
        fill: { fgColor: { rgb: "F1F5F9" } }, // very light gray
      };
    }
  });

  // ── Sheet 2: Instructions ──────────────────────────────────────────────
  const instrHeaders = ["Field", "Required?", "Description", "Allowed Values", "Example"];
  const instrRows = config.fields.map((f) => [
    f.column,
    f.required ? "Yes" : "No",
    f.description,
    f.allowedValues ? f.allowedValues.join(", ") : "",
    f.exampleValue,
  ]);

  const instrSheetData = [instrHeaders, ...instrRows];
  const instrSheet = XLSX.utils.aoa_to_sheet(instrSheetData);

  instrSheet["!cols"] = [
    { wch: 28 }, // Field
    { wch: 12 }, // Required?
    { wch: 50 }, // Description
    { wch: 40 }, // Allowed Values
    { wch: 30 }, // Example
  ];

  // Style header row
  instrHeaders.forEach((_, colIdx) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (instrSheet[cell]) {
      instrSheet[cell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E293B" } },
      };
    }
  });

  // Alternating row shading on instruction rows
  instrRows.forEach((_, rowIdx) => {
    if (rowIdx % 2 === 0) return; // skip even rows
    instrHeaders.forEach((_, colIdx) => {
      const cell = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
      if (instrSheet[cell]) {
        instrSheet[cell].s = {
          fill: { fgColor: { rgb: "F8FAFC" } },
        };
      }
    });
  });

  // ── Build workbook ─────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, "Data");
  XLSX.utils.book_append_sheet(wb, instrSheet, "Instructions");

  // Write with cellStyles enabled
  return XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true }) as Uint8Array;
}
