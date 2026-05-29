/**
 * Cursor pagination helper for "fetch pageSize + 1, slice off the
 * sentinel" patterns. Pure function — testable in isolation without
 * spinning up the router or D1.
 *
 * @param rows  Up to `pageSize + 1` rows fetched from the DB, ordered.
 * @param pageSize  The page size the caller intended (e.g. 10).
 * @returns `items` clamped to `pageSize`, and `nextCursor` set to the
 *          last item's id when more rows exist (else `undefined`).
 */
export function paginate<T extends { id: string }>(
	rows: T[],
	pageSize: number
): { items: T[]; nextCursor: string | undefined } {
	const hasMore = rows.length > pageSize;
	const items = hasMore ? rows.slice(0, pageSize) : rows;
	const nextCursor = hasMore ? items.at(-1)?.id : undefined;
	return { items, nextCursor };
}
