import {
	hashKey,
	type InfiniteData,
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
	replayFailed: boolean;
	settled: boolean;
}

interface QueryUpdateGroup {
	dispose: () => void;
	disposed: boolean;
	previous: QuerySnapshot;
	updates: PendingQueryUpdate[];
	writing: boolean;
}

const queryUpdateGroups = new WeakMap<
	QueryClient,
	Map<string, QueryUpdateGroup>
>();

function isInfiniteData(data: unknown): data is InfiniteData<unknown> {
	return (
		typeof data === "object" &&
		data !== null &&
		"pages" in data &&
		Array.isArray(data.pages) &&
		"pageParams" in data &&
		Array.isArray(data.pageParams)
	);
}

function mergeFetchedPage(previous: unknown, fetched: unknown): unknown {
	if (!(isInfiniteData(previous) && isInfiniteData(fetched))) {
		return fetched;
	}
	const previousPages = new Map(
		previous.pageParams.map((param, index) => [
			hashKey([param]),
			previous.pages[index],
		])
	);
	return {
		...fetched,
		pages: fetched.pages.map((page, index) => {
			const key = hashKey([fetched.pageParams[index]]);
			return previousPages.has(key) ? previousPages.get(key) : page;
		}),
	};
}

function restoreQueryData(queryClient: QueryClient, snapshot: QuerySnapshot) {
	if (snapshot.data === undefined) {
		queryClient
			.getQueryCache()
			.find({ queryKey: snapshot.queryKey, exact: true })
			?.setState({ data: undefined, dataUpdatedAt: 0, status: "pending" });
		return;
	}
	queryClient.setQueryData(snapshot.queryKey, snapshot.data);
}

function replayQueryUpdates(queryClient: QueryClient, group: QueryUpdateGroup) {
	group.writing = true;
	try {
		restoreQueryData(queryClient, group.previous);
		for (const update of group.updates) {
			if (update.failed || update.replayFailed) {
				continue;
			}
			const previous = snapshotQuery(queryClient, group.previous.queryKey);
			try {
				update.apply();
			} catch {
				update.replayFailed = true;
				restoreQueryData(queryClient, previous);
			}
		}
	} finally {
		group.writing = false;
	}
}

function createQueryUpdateGroup(
	queryClient: QueryClient,
	queryKey: QueryKey,
	groups: Map<string, QueryUpdateGroup>,
	key: string
): QueryUpdateGroup {
	const group: QueryUpdateGroup = {
		dispose: () => undefined,
		disposed: false,
		previous: snapshotQuery(queryClient, queryKey),
		updates: [],
		writing: false,
	};
	const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
		if (group.writing || hashKey(event.query.queryKey) !== key) {
			return;
		}
		if (event.type === "removed") {
			group.dispose();
			return;
		}
		if (event.type !== "updated") {
			return;
		}
		if (event.action.type === "success") {
			const fetched = event.query.state.data;
			group.previous = {
				...group.previous,
				data:
					!event.action.manual && event.query.state.fetchMeta?.fetchMore
						? mergeFetchedPage(group.previous.data, fetched)
						: fetched,
			};
			replayQueryUpdates(queryClient, group);
		}
		if (
			event.query.state.fetchStatus === "idle" &&
			group.updates.every((update) => update.settled)
		) {
			group.dispose();
		}
	});
	group.dispose = () => {
		group.disposed = true;
		unsubscribe();
		if (groups.get(key) === group) {
			groups.delete(key);
		}
	};
	groups.set(key, group);
	return group;
}

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
	const group =
		groups.get(key) ??
		createQueryUpdateGroup(queryClient, queryKey, groups, key);
	const previous = snapshotQuery(queryClient, queryKey);
	group.writing = true;
	try {
		apply();
	} catch (error) {
		restoreQueryData(queryClient, previous);
		if (group.updates.length === 0) {
			group.dispose();
		}
		throw error;
	} finally {
		group.writing = false;
	}
	const update = { apply, failed: false, replayFailed: false, settled: false };
	group.updates.push(update);
	return {
		settle(succeeded: boolean): boolean {
			if (update.settled || group.disposed) {
				return false;
			}
			update.failed = !succeeded;
			update.settled = true;
			if (!succeeded) {
				replayQueryUpdates(queryClient, group);
			}
			if (group.updates.some((entry) => !entry.settled)) {
				return false;
			}
			const fetchStatus = queryClient.getQueryState(queryKey)?.fetchStatus;
			if (!fetchStatus || fetchStatus === "idle") {
				group.dispose();
			}
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
