import {
	hashKey,
	type QueryClient,
	type QueryFilters,
	type QueryKey,
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

interface PendingQueryUpdate {
	apply: () => void;
	failed: boolean;
	settled: boolean;
}

interface QueryUpdateGroup {
	previous: QuerySnapshot;
	updates: PendingQueryUpdate[];
}

const queryUpdateGroups = new WeakMap<
	QueryClient,
	Map<string, QueryUpdateGroup>
>();

export function beginOptimisticQueryUpdate(
	queryClient: QueryClient,
	queryKey: QueryKey,
	apply: () => void
) {
	let groups = queryUpdateGroups.get(queryClient);
	if (!groups) {
		groups = new Map();
		queryUpdateGroups.set(queryClient, groups);
	}
	const key = hashKey(queryKey);
	let group = groups.get(key);
	if (!group) {
		group = { previous: snapshotQuery(queryClient, queryKey), updates: [] };
		groups.set(key, group);
	}
	const update = { apply, failed: false, settled: false };
	group.updates.push(update);
	apply();
	const currentGroup = group;
	const currentGroups = groups;
	return {
		settle(succeeded: boolean): boolean {
			update.failed = !succeeded;
			update.settled = true;
			if (!succeeded) {
				restoreSnapshots(queryClient, [currentGroup.previous]);
				for (const remaining of currentGroup.updates) {
					if (!remaining.failed) {
						remaining.apply();
					}
				}
			}
			if (currentGroup.updates.some((entry) => !entry.settled)) {
				return false;
			}
			currentGroups.delete(key);
			return true;
		},
	};
}

export function createOptimisticId(prefix: string): string {
	return `${prefix}-${crypto.randomUUID()}`;
}

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

export function updateQueryEntity<TEntity extends object>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	patch: Partial<TEntity> | ((entity: TEntity) => Partial<TEntity>)
): void {
	queryClient.setQueryData<TEntity>(queryKey, (old) => {
		if (!old) {
			return old;
		}
		return { ...old, ...(typeof patch === "function" ? patch(old) : patch) };
	});
}

export function updateQueryData<TData>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	updateData: (old: TData | undefined) => TData | undefined
): void {
	queryClient.setQueryData<TData>(queryKey, updateData);
}

export function updateQueriesData<TData>(
	queryClient: QueryClient,
	filters: Pick<QueryFilters, "queryKey">,
	updateData: (old: TData | undefined) => TData | undefined
): void {
	queryClient.setQueriesData<TData>(filters, updateData);
}
export function updateQueryItems<TItem>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	updateItems: (items: TItem[]) => TItem[],
	fallbackItems?: TItem[]
): void {
	queryClient.setQueryData<TItem[]>(queryKey, (old) =>
		old ? updateItems(old) : fallbackItems
	);
}

export function prependInfiniteQueryItem<TItem>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	item: TItem
): void {
	queryClient.setQueryData<{
		pageParams: unknown[];
		pages: { items: TItem[] }[];
	}>(queryKey, (old) => {
		if (!old || old.pages.length === 0) {
			return old;
		}
		const [first, ...rest] = old.pages;
		if (!first) {
			return old;
		}
		return {
			...old,
			pages: [{ ...first, items: [item, ...first.items] }, ...rest],
		};
	});
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
