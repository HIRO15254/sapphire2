/**
 * Column model of the blind structure table: the three data columns between
 * the level cell and the Min cell (blind1 / blind2 / ante — or, in per-level
 * mix mode, the merged Games cell). Rows that span or replace those columns
 * derive their colSpan from this constant instead of re-encoding the layout
 * as a literal.
 */
export const BLIND_DATA_COLUMNS = 3;
