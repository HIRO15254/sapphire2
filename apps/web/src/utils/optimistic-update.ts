import type {
	QueryClient,
	QueryFilters,
	QueryKey,
} from "@tanstack/react-query";

export type OptimisticTarget =
	| { queryKey: QueryKey }
	| { filters: Pick<QueryFilters, "queryKey"> };

export interface QuerySnapshot<TData = unknown> {
	data: TData;
	kind: "query";
	queryKey: QueryKey;
}

export interface QueriesSnapshot<TData = unknown> {
	entries: [QueryKey, TData | undefined][];
	kind: "queries";
}

export type OptimisticSnapshot<TData = unknown> =
	| QueriesSnapshot<TData>
	| QuerySnapshot<TData>;

function getFilters(target: OptimisticTarget): Pick<QueryFilters, "queryKey"> {
	return "queryKey" in target ? { queryKey: target.queryKey } : target.filters;
}

export async function cancelTargets(
	queryClient: QueryClient,
	targets: OptimisticTarget[]
) {
	await Promise.all(
		targets.map((target) => queryClient.cancelQueries(getFilters(target)))
	);
}

export async function invalidateTargets(
	queryClient: QueryClient,
	targets: OptimisticTarget[]
) {
	await Promise.all(
		targets.map((target) => queryClient.invalidateQueries(getFilters(target)))
	);
}

export function snapshotQuery<TData = unknown>(
	queryClient: QueryClient,
	queryKey: QueryKey
): QuerySnapshot<TData | undefined> {
	return {
		data: queryClient.getQueryData<TData>(queryKey),
		kind: "query",
		queryKey,
	};
}

export function snapshotQueries<TData = unknown>(
	queryClient: QueryClient,
	filters: Pick<QueryFilters, "queryKey">
): QueriesSnapshot<TData> {
	return {
		entries: queryClient.getQueriesData<TData>(filters),
		kind: "queries",
	};
}

/**
 * Optimistically rewrite the items of every page in a `useInfiniteQuery`
 * cache entry. The page envelope (`nextCursor`, `pageParams`, …) is preserved;
 * only `page.items` is mapped through `updateItems`. Use for edit (`.map`) and
 * delete (`.filter`) flows so the change lives in the cache and survives the
 * next refetch instead of an in-memory list that gets wiped.
 */
export function updateInfiniteQueryItems<TItem>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	updateItems: (items: TItem[]) => TItem[]
): void {
	queryClient.setQueryData<{
		pageParams: unknown[];
		pages: { items: TItem[] }[];
	}>(
		queryKey,
		(old) =>
			old && {
				...old,
				pages: old.pages.map((page) => ({
					...page,
					items: updateItems(page.items),
				})),
			}
	);
}

export function restoreSnapshots(
	queryClient: QueryClient,
	snapshots: Array<OptimisticSnapshot | null | undefined>
) {
	for (const snapshot of snapshots) {
		if (!snapshot) {
			continue;
		}

		if (snapshot.kind === "query") {
			queryClient.setQueryData(snapshot.queryKey, snapshot.data);
			continue;
		}

		for (const [queryKey, data] of snapshot.entries) {
			queryClient.setQueryData(queryKey, data);
		}
	}
}
