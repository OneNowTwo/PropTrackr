export const INSPECTION_DURATION_OPTIONS = [15, 30, 45, 60] as const;

export const DOCUMENT_TYPE_OPTIONS = [
  "Contract",
  "Pest Report",
  "Strata Report",
  "Building Report",
  "Floor Plan",
  "Other",
] as const;

export type DocumentTypeOption = (typeof DOCUMENT_TYPE_OPTIONS)[number];
