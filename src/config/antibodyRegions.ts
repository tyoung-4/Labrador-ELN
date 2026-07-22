export const CHAINS = {
  HEAVY_A: 'Heavy Chain A',
  HEAVY_B: 'Heavy Chain B',
  LIGHT_A: 'Light Chain A',
  LIGHT_B: 'Light Chain B',
} as const

export const HEAVY_REGIONS = ['VH', 'CDR_H1', 'CDR_H2', 'CDR_H3', 'CH1', 'HINGE', 'CH2', 'CH3', 'N_TERM', 'C_TERM'] as const
export const LIGHT_REGIONS = ['VL', 'CDR_L1', 'CDR_L2', 'CDR_L3', 'CL', 'N_TERM', 'C_TERM'] as const

export const REGION_LABELS: Record<string, string> = {
  VH: 'VH (Variable Heavy)',
  VL: 'VL (Variable Light)',
  CH1: 'CH1', CH2: 'CH2', CH3: 'CH3',
  CL: 'CL (Constant Light)',
  HINGE: 'Hinge',
  CDR_H1: 'CDR-H1', CDR_H2: 'CDR-H2', CDR_H3: 'CDR-H3',
  CDR_L1: 'CDR-L1', CDR_L2: 'CDR-L2', CDR_L3: 'CDR-L3',
  N_TERM: 'N-terminus', C_TERM: 'C-terminus',
  BINDER: 'Binder',
}

export const ANNOTATION_TYPES = {
  POINT_MUTATION: { label: 'Point Mutation', color: '#3b82f6' },   // blue
  DISULFIDE: { label: 'Engineered Disulfide', color: '#f97316' },  // orange
  GLYCOSYLATION: { label: 'Glycosylation', color: '#22c55e' },     // green
  DOMAIN_SWAP: { label: 'Domain Swap', color: '#8b5cf6' },         // purple
  TAG: { label: 'Tag', color: '#64748b' },                          // gray
} as const

export const ANTIBODY_FORMATS = [
  'IgG1', 'IgG2', 'IgG3', 'IgG4',
  'Bispecific (KiH)', 'Fab', 'F(ab)2', 'scFv', 'Nanobody', 'Other'
] as const
