export function paginate<T extends { id: string }>(
	rows: T[],
	pageSize: number
): { items: T[]; nextCursor: string | undefined } {
	const hasMore = rows.length > pageSize;
	const items = hasMore ? rows.slice(0, pageSize) : rows;
	const nextCursor = hasMore ? items.at(-1)?.id : undefined;
	return { items, nextCursor };
}
