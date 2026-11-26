import { persistQueryClientSubscribe } from "@tanstack/react-query-persist-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldPersistQuery } from "@/utils/query-persistence";
import { clearPersistedQueryCache, persister, queryClient } from "@/utils/trpc";

const PERSISTED_CLIENT_KEY = "sapphire2-query-cache";

const idb = vi.hoisted(() => {
	const store = new Map<string, unknown>();
	let queue: Promise<unknown> = Promise.resolve();
	const enqueue = <T,>(operation: () => T): Promise<T> => {
		const result = queue.then(operation);
		queue = result.catch(() => undefined);
		return result;
	};
	return {
		del: (key: string) =>
			enqueue(() => {
				store.delete(key);
			}),
		get: (key: string) => enqueue(() => store.get(key)),
		set: (key: string, value: unknown) =>
			enqueue(() => {
				store.set(key, value);
			}),
		store,
	};
});

vi.mock("idb-keyval", () => ({ del: idb.del, get: idb.get, set: idb.set }));

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));

function persistedQueryData(): unknown[] {
	const persisted = idb.store.get(PERSISTED_CLIENT_KEY);
	if (typeof persisted !== "string") {
		return [];
	}
	const client = JSON.parse(persisted) as {
		clientState: { queries: { state: { data: unknown } }[] };
	};
	return client.clientState.queries.map((query) => query.state.data);
}

describe("sign-out cache wipe", () => {
	let unsubscribe: () => void = () => undefined;

	beforeEach(() => {
		vi.useFakeTimers();
		unsubscribe = persistQueryClientSubscribe({
			dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
			persister,
			queryClient,
		});
	});

	afterEach(async () => {
		unsubscribe();
		queryClient.clear();
		await vi.runAllTimersAsync();
		idb.store.clear();
		vi.useRealTimers();
	});

	it("leaves none of the signed-out user's queries in memory or in the persisted store", async () => {
		queryClient.setQueryData(["account", "one"], "A-PRIVATE-1");
		queryClient.setQueryData(["account", "two"], "A-PRIVATE-2");
		queryClient.setQueryData(["account", "three"], "A-PRIVATE-3");
		await vi.advanceTimersByTimeAsync(2500);
		expect(persistedQueryData()).toHaveLength(3);

		await clearPersistedQueryCache();

		expect(queryClient.getQueryCache().getAll()).toEqual([]);
		expect(persistedQueryData()).toEqual([]);

		await vi.advanceTimersByTimeAsync(2500);
		expect(persistedQueryData()).toEqual([]);
	});

	it("keeps persisting the next user's queries once the wipe has finished", async () => {
		queryClient.setQueryData(["account", "one"], "A-PRIVATE-1");
		await vi.advanceTimersByTimeAsync(2500);

		await clearPersistedQueryCache();
		queryClient.setQueryData(["account", "one"], "B-PRIVATE-1");
		await vi.advanceTimersByTimeAsync(2500);

		expect(persistedQueryData()).toEqual(["B-PRIVATE-1"]);
	});
});
