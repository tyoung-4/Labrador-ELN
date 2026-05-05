/**
 * Capitalizes a tag name according to Labrador ELN rules:
 *
 * Split on '-' and '.' (keeping delimiters), then for each alphabetic token:
 *   - All alpha, ≤ 4 chars → FULL UPPERCASE  ("akta" → "AKTA")
 *   - All alpha, > 4 chars → Capitalize first, lowercase rest  ("protein" → "Protein")
 *   - Mixed alpha+numeric   → Uppercase all alpha chars  ("cd38" → "CD38", "v1" → "V1")
 *   - All numeric           → unchanged  ("2" → "2")
 *   - Delimiter ('-', '.')  → unchanged
 *
 * Examples:
 *   capitalizeTag("cd38")         → "CD38"
 *   capitalizeTag("CD38-protein") → "CD38-Protein"
 *   capitalizeTag("akta")         → "AKTA"
 *   capitalizeTag("protein")      → "Protein"
 *   capitalizeTag("v1")           → "V1"
 *   capitalizeTag("2")            → "2"
 */
/**
 * Generates a short-tag suggestion from a project name.
 * Takes the first 5 characters of each whitespace-delimited word, uppercased, joined with '-'.
 * Example: "CD38 Antibody Optimization Phase 2" → "CD38A-ANTIB-OPTIM-PHASE-2"
 */
export function suggestShortTag(projectName: string): string {
  return projectName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 5).toUpperCase())
    .join("-");
}

export function capitalizeTag(input: string): string {
  // Split on delimiters keeping them as separate tokens
  const parts = input.split(/([-.])/);

  return parts
    .map((part) => {
      // Delimiter or empty → pass through
      if (part === "-" || part === "." || part === "") return part;

      const isAllAlpha = /^[A-Za-z]+$/.test(part);
      const isAllNumeric = /^[0-9]+$/.test(part);
      const isMixed = !isAllAlpha && !isAllNumeric;

      if (isAllNumeric) {
        return part;
      }

      if (isAllAlpha) {
        if (part.length <= 4) {
          return part.toUpperCase();
        } else {
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }
      }

      if (isMixed) {
        // Uppercase all alphabetic characters, leave digits as-is
        return part.replace(/[A-Za-z]/g, (c) => c.toUpperCase());
      }

      return part;
    })
    .join("");
}
