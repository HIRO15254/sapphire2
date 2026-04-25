import {
	QueryClient,
	QueryClientProvider,
	type UseMutationOptions,
	type UseMutationResult,
	type UseQueryOptions,
	type UseQueryResult,
} from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import type { FC, ReactElement, ReactNode } from "react";
import { vi } from "vitest";

// ─── QueryClient ─────────────────────────────────────────────────────────────

/**
 * Minimal QueryClient for tests — no retry, no cache GC, infinite stale time.
 * Use in any test that renders a hook/component depending on react-query.
 */
export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
				staleTime: Number.POSITIVE_INFINITY,
			},
			mutations: { retry: false },
		},
	});
}

/** Wrapper for `renderHook`/`render` that provides a QueryClient. */
export function withQueryClient(
	client?: QueryClient
): FC<{ children: ReactNode }> {
	const qc = client ?? createTestQueryClient();
	const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
	return Wrapper;
}

/**
 * `render` that supplies a QueryClient and returns it on the result.
 * Caller can reach into `queryClient` to seed or inspect cache.
 */
export function renderWithQueryClient(
	ui: ReactElement,
	options: Omit<RenderOptions, "wrapper"> & { queryClient?: QueryClient } = {}
): ReturnType<typeof render> & { queryClient: QueryClient } {
	const { queryClient, ...renderOptions } = options;
	const qc = queryClient ?? createTestQueryClient();
	return {
		...render(ui, { ...renderOptions, wrapper: withQueryClient(qc) }),
		queryClient: qc,
	};
}

// ─── tRPC shape factory ──────────────────────────────────────────────────────

type MutateFn = (input?: unknown) => Promise<unknown>;
type QueryFn = (input?: unknown) => Promise<unknown>;

export interface TrpcProcMock {
	mutate: ReturnType<typeof vi.fn<MutateFn>>;
	mutationOptions: ReturnType<
		typeof vi.fn<(options?: UseMutationOptions) => UseMutationOptions>
	>;
	query: ReturnType<typeof vi.fn<QueryFn>>;
	queryOptions: ReturnType<typeof vi.fn<(input?: unknown) => UseQueryOptions>>;
}

type TrpcNamespace = Record<string, TrpcProcMock>;
type TrpcRoot = Record<string, TrpcNamespace>;

function buildQueryKey(
	namespace: string,
	procedure: string,
	input: unknown
): unknown[] {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

function createProcMock(namespace: string, procedure: string): TrpcProcMock {
	return {
		mutate: vi.fn(async (input?: unknown) => input) as TrpcProcMock["mutate"],
		query: vi.fn(async () => undefined) as TrpcProcMock["query"],
		mutationOptions: vi.fn(
			(options?: UseMutationOptions) =>
				({
					...(options ?? {}),
					mutationKey: [namespace, procedure],
				}) as UseMutationOptions
		) as TrpcProcMock["mutationOptions"],
		queryOptions: vi.fn(
			(input?: unknown) =>
				({
					queryKey: buildQueryKey(namespace, procedure, input),
				}) as UseQueryOptions
		) as TrpcProcMock["queryOptions"],
	};
}

/**
 * Build an auto-materializing mock of the tRPC client / proxy shape.
 *
 * Access any namespace/procedure path (`mock.currency.list.query`, `mock.player.create.mutate`)
 * and receive a typed `vi.fn()` you can seed with return values and assert on.
 *
 * Typical usage:
 * ```ts
 * const trpcClient = createTrpcMock();
 * const trpc = createTrpcMock();
 * vi.mock("@/utils/trpc", () => ({ trpc, trpcClient }));
 * ```
 */
export function createTrpcMock(): TrpcRoot {
	const root = {} as TrpcRoot;
	return new Proxy(root, {
		get(target, namespace: string) {
			if (namespace === "then") {
				// Avoid confusing `await` into thenable resolution.
				return;
			}
			if (!(namespace in target)) {
				const ns = {} as TrpcNamespace;
				target[namespace] = new Proxy(ns, {
					get(innerTarget, procedure: string) {
						if (procedure === "then") {
							return;
						}
						if (!(procedure in innerTarget)) {
							innerTarget[procedure] = createProcMock(namespace, procedure);
						}
						return innerTarget[procedure];
					},
				});
			}
			return target[namespace];
		},
	});
}

// ─── Common external module mocks ────────────────────────────────────────────

/** Minimal `sonner` toast surface; spies stay addressable across tests. */
export function createToastMock() {
	return {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		message: vi.fn(),
		loading: vi.fn(),
		dismiss: vi.fn(),
	};
}

/** Minimal Better Auth `authClient.useSession` and signIn/signUp surface. */
export function createAuthClientMock(
	session: {
		data: { user: { email: string; name: string } } | null;
		isPending: boolean;
		error?: Error | null;
	} = { data: null, isPending: false, error: null }
) {
	return {
		useSession: vi.fn(() => session),
		signIn: {
			email: vi.fn(async () => ({ data: session.data, error: null })),
			social: vi.fn(async () => ({ data: null, error: null })),
		},
		signUp: {
			email: vi.fn(async () => ({ data: session.data, error: null })),
		},
		signOut: vi.fn(async () => ({ data: null, error: null })),
		getSession: vi.fn(async () => session),
	};
}

// ─── Reuse across hook/component/route tests ────────────────────────────────

/** Vitest MutationResult stand-in when we only need `isPending` + `mutate`. */
export function createMutationStub<TInput = unknown, TOutput = unknown>(
	fn?: (input: TInput) => Promise<TOutput>
): UseMutationResult<TOutput, Error, TInput> {
	const stub = {
		mutate: vi.fn(async (input: TInput) => fn?.(input)),
		mutateAsync: vi.fn(
			async (input: TInput) => fn?.(input) as Promise<TOutput>
		),
		isPending: false,
		isError: false,
		isSuccess: false,
		isIdle: true,
		data: undefined,
		error: null,
		reset: vi.fn(),
		status: "idle",
		variables: undefined,
		context: undefined,
		failureCount: 0,
		failureReason: null,
		isPaused: false,
		submittedAt: 0,
	};
	return stub as unknown as UseMutationResult<TOutput, Error, TInput>;
}

/** Vitest QueryResult stand-in seeded with `data` and `isLoading`. */
export function createQueryStub<TData = unknown>(
	data: TData,
	isLoading = false
): UseQueryResult<TData, Error> {
	const stub = {
		data,
		error: null,
		isError: false,
		isLoading,
		isPending: isLoading,
		isFetching: isLoading,
		isSuccess: !isLoading,
		isRefetching: false,
		isStale: false,
		status: isLoading ? "pending" : "success",
		fetchStatus: isLoading ? "fetching" : "idle",
		refetch: vi.fn(),
		dataUpdatedAt: 0,
		errorUpdatedAt: 0,
		failureCount: 0,
		failureReason: null,
		isFetched: !isLoading,
		isFetchedAfterMount: !isLoading,
		isInitialLoading: isLoading,
		isLoadingError: false,
		isPlaceholderData: false,
		isPreviousData: false,
		isRefetchError: false,
		isStaleByTime: () => false,
	};
	return stub as unknown as UseQueryResult<TData, Error>;
}
