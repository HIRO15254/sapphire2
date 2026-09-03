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
import { onTestFinished, vi } from "vitest";

export const OAUTH_AUTHORIZE_SEARCH =
	"?client_id=c1&response_type=code&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&state=s1";

export function stubLocation(overrides: Partial<Location> = {}): void {
	const original = window.location;
	Object.defineProperty(window, "location", {
		configurable: true,
		value: { ...original, assign: vi.fn(), ...overrides },
	});
	onTestFinished(() => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: original,
		});
	});
}

export function locationAssignCalls(): unknown[][] {
	return (window.location.assign as unknown as ReturnType<typeof vi.fn>).mock
		.calls;
}

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

export function withQueryClient(
	client?: QueryClient
): FC<{ children: ReactNode }> {
	const qc = client ?? createTestQueryClient();
	const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
	return Wrapper;
}

export function startPendingMutation(queryClient: QueryClient): {
	done: Promise<void>;
	settle: () => void;
} {
	let resolve: () => void = () => undefined;
	const gate = new Promise<void>((finish) => {
		resolve = finish;
	});
	const mutation = queryClient.getMutationCache().build(queryClient, {
		mutationFn: () => gate,
	});
	const done = mutation.execute(undefined);
	return { done, settle: () => resolve() };
}

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

export function createTrpcMock(): TrpcRoot {
	const root = {} as TrpcRoot;
	return new Proxy(root, {
		get(target, namespace: string) {
			if (namespace === "then") {
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

export function stubWebAuthnSupport(supported: boolean): () => void {
	const had = "PublicKeyCredential" in window;
	const previous = (window as { PublicKeyCredential?: unknown })
		.PublicKeyCredential;
	if (supported) {
		(window as { PublicKeyCredential?: unknown }).PublicKeyCredential = {};
	} else {
		Reflect.deleteProperty(window, "PublicKeyCredential");
	}
	return () => {
		if (had) {
			(window as { PublicKeyCredential?: unknown }).PublicKeyCredential =
				previous;
		} else {
			Reflect.deleteProperty(window, "PublicKeyCredential");
		}
	};
}

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
