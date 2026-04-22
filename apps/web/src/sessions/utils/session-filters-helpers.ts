import type { SessionFilterValues } from "@/sessions/components/session-filters";

export function countActiveFilters(filters: SessionFilterValues): number {
	let count = 0;
	if (filters.type) {
		count++;
	}
	if (filters.storeId) {
		count++;
	}
	if (filters.currencyId) {
		count++;
	}
	if (filters.dateFrom) {
		count++;
	}
	if (filters.dateTo) {
		count++;
	}
	return count;
}
