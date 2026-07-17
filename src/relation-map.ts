// ============================================================
//  Relation Map - relation field mapping definitions
// ============================================================

/**
 * Defines the reverse mapping for relation fields
 * up <-> down: parent-child relation
 * same <-> same: sibling relation (symmetric)
 * next <-> prev: sequential relation
 */
export const RELATION_MAP: Record<string, string> = {
  up: "down",
  down: "up",
  same: "same",
  next: "prev",
  prev: "next",
};

/**
 * All supported relation fields
 */
export const RELATION_FIELDS = Object.keys(RELATION_MAP);

/**
 * Get the reverse field for a given field
 */
export function getReverseField(field: string): string | undefined {
  return RELATION_MAP[field];
}

/**
 * Check whether a field is a supported relation field
 */
export function isRelationField(field: string): boolean {
  return field in RELATION_MAP;
}
