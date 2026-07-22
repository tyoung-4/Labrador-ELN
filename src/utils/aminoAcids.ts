export const CANONICAL_AA = 'ACDEFGHIKLMNPQRSTVWY'.split('')

export const AA_NAMES: Record<string, string> = {
  A: 'Alanine', C: 'Cysteine', D: 'Aspartate', E: 'Glutamate',
  F: 'Phenylalanine', G: 'Glycine', H: 'Histidine', I: 'Isoleucine',
  K: 'Lysine', L: 'Leucine', M: 'Methionine', N: 'Asparagine',
  P: 'Proline', Q: 'Glutamine', R: 'Arginine', S: 'Serine',
  T: 'Threonine', V: 'Valine', W: 'Tryptophan', Y: 'Tyrosine'
}

export function isCanonicalAA(residue: string): boolean {
  return CANONICAL_AA.includes(residue.toUpperCase())
}

export function validatePointMutation(params: {
  wtResidue: string
  mutResidue: string
  position: number
  isNonCanonical: boolean
  ncaaIdentity?: string
}): { valid: boolean; error?: string } {
  const { wtResidue, mutResidue, position, isNonCanonical, ncaaIdentity } = params

  if (!isCanonicalAA(wtResidue)) {
    return { valid: false, error: `WT residue "${wtResidue}" is not a canonical amino acid` }
  }
  if (!Number.isInteger(position) || position <= 0) {
    return { valid: false, error: 'Position must be a positive integer' }
  }
  if (mutResidue.toUpperCase() === 'X') {
    if (!isNonCanonical || !ncaaIdentity?.trim()) {
      return { valid: false, error: 'Non-canonical mutation (X) requires specifying the ncAA identity' }
    }
    return { valid: true }
  }
  if (!isCanonicalAA(mutResidue)) {
    return { valid: false, error: `Mutant residue "${mutResidue}" is not canonical. Use "X" for non-canonical amino acids.` }
  }
  return { valid: true }
}

export function formatMutation(annotation: {
  wtResidue?: string | null
  position?: number | null
  mutResidue?: string | null
  isNonCanonical?: boolean
  ncaaIdentity?: string | null
}): string {
  const { wtResidue, position, mutResidue, isNonCanonical, ncaaIdentity } = annotation
  if (!wtResidue || !position || !mutResidue) return ''
  const base = `${wtResidue}${position}${mutResidue}`
  if (isNonCanonical && ncaaIdentity) {
    return `${base} (${ncaaIdentity})`
  }
  return base
}
