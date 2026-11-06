import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { setupServer } from "msw/node";
import { useState } from "react";
import { toast } from "sonner";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import z from "zod";
import { FormSheet } from "@/shared/components/form-sheet";
import { LoadErrorState } from "@/shared/components/query-state";
import { Toaster } from "@/shared/components/ui/sonner";
import { useUndoableMutation } from "@/shared/hooks/use-undoable-mutation";
import {
	type QuerySnapshot,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { queryClient as appQueryClient } from "@/utils/trpc";
import { renderIntegrationPage, trpcHttpHandler } from "./integration";
import { createTestQueryClient } from "./test-utils";

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));

const t = initTRPC.create();
const undoName = /Undo/u;
const notFoundText = /not found/iu;
let value = "before";
let failSave = false;
let failUndo = false;
let failLoad = false;
let loadGate: Promise<void> | undefined;
let saveGate: Promise<void> | undefined;
let concurrentSave = false;
const router = t.router({
	read: t.procedure.query(async () => {
		if (loadGate) {
			await loadGate;
		}
		if (failLoad) {
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
		}
		return value;
	}),
	write: t.procedure.input(z.string()).mutation(async ({ input }) => {
		if (saveGate) {
			await saveGate;
		}
		if (concurrentSave) {
			value = "changed elsewhere";
			throw new TRPCError({
				code: "CONFLICT",
				message: "This was changed elsewhere. Reload and try again.",
			});
		}
		if (failSave || (failUndo && input === "before")) {
			throw new TRPCError({ code: "CONFLICT" });
		}
		value = input;
		return input;
	}),
});
const server = setupServer(trpcHttpHandler("http://localhost:3000", router));
const client = createTRPCClient<typeof router>({
	links: [httpBatchLink({ url: "http://localhost:3000/trpc" })],
});
let queryClient = createTestQueryClient();
let trpc = createTRPCOptionsProxy({ client, queryClient });

function Probe({ destructive = false }: { destructive?: boolean }) {
	const [open, setOpen] = useState(true);
	const mutation = useUndoableMutation(
		trpc.write.mutationOptions({ onMutate: () => value }),
		destructive
			? { destructive: true, message: "Record deleted" }
			: {
					inverse: async (_variables, _data, previous) => {
						await client.write.mutate(previous ?? "before");
					},
					message: "Record updated",
				}
	);
	const form = useForm({
		defaultValues: { name: "" },
		onSubmit: async ({ value: fields }) => {
			try {
				await mutation.mutateAsync(fields.name);
				setOpen(false);
			} catch {}
		},
	});
	return (
		<>
			<Toaster />
			<FormSheet
				formId="probe"
				isLoading={mutation.isPending}
				onOpenChange={setOpen}
				open={open}
				title="Edit record"
			>
				<form
					id="probe"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.Field name="name">
						{(field) => (
							<label>
								Name
								<input
									aria-label="Name"
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							</label>
						)}
					</form.Field>
				</form>
			</FormSheet>
		</>
	);
}

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({
			addEventListener: vi.fn(),
			matches: false,
			removeEventListener: vi.fn(),
		}),
	});
	server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
	value = "before";
	failSave = false;
	failUndo = false;
	failLoad = false;
	loadGate = undefined;
	saveGate = undefined;
	concurrentSave = false;
	queryClient = createTestQueryClient();
	trpc = createTRPCOptionsProxy({ client, queryClient });
});
afterAll(() => server.close());
afterEach(() => {
	server.resetHandlers();
	toast.dismiss();
	vi.useRealTimers();
});

function QueryProbe() {
	const query = useQuery(trpc.read.queryOptions());
	if (query.isPending) {
		return <div>Loading</div>;
	}
	if (query.isError) {
		return (
			<LoadErrorState
				entity="record"
				isRetrying={query.isFetching}
				onRetry={() => {
					query.refetch();
				}}
			/>
		);
	}
	return <div>{query.data}</div>;
}

it("refetches a failed load without presenting not-found while loading", async () => {
	failLoad = true;
	renderIntegrationPage(<QueryProbe />, { path: "/", queryClient });
	await screen.findByRole("alert");
	const gate = Promise.withResolvers<void>();
	loadGate = gate.promise;
	failLoad = false;
	fireEvent.click(screen.getByRole("button", { name: "Retry" }));
	await screen.findByText("Loading");
	expect(screen.queryByText(notFoundText)).not.toBeInTheDocument();
	gate.resolve();
	await screen.findByText("before");
});

async function submit(name = "after") {
	fireEvent.change(await screen.findByLabelText("Name"), {
		target: { value: name },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

function ConflictProbe() {
	const key = trpc.read.queryKey();
	const query = useQuery(trpc.read.queryOptions());
	const mutation = useUndoableMutation(
		trpc.write.mutationOptions({
			onError: (_error, _next, snapshot: QuerySnapshot | undefined) => {
				restoreSnapshots(queryClient, [snapshot]);
			},
			onMutate: (next) => {
				const snapshot = snapshotQuery(queryClient, key);
				queryClient.setQueryData(key, next);
				return snapshot;
			},
		}),
		{ destructive: true, message: "Saved" }
	);
	return (
		<>
			<Toaster />
			<div>{query.data}</div>
			<button
				onClick={() =>
					mutation.mutateAsync("optimistic").catch(() => undefined)
				}
				type="button"
			>
				Save conflict
			</button>
		</>
	);
}

it("rolls back and refetches after a concurrent change", async () => {
	queryClient = appQueryClient;
	queryClient.clear();
	trpc = createTRPCOptionsProxy({ client, queryClient });
	renderIntegrationPage(<ConflictProbe />, { path: "/", queryClient });
	await screen.findByText("before");
	const { promise, resolve } = Promise.withResolvers<void>();
	loadGate = promise;
	const save = Promise.withResolvers<void>();
	saveGate = save.promise;
	concurrentSave = true;
	fireEvent.click(screen.getByRole("button", { name: "Save conflict" }));
	await screen.findByText("optimistic");
	save.resolve();
	await screen.findByText("This was changed elsewhere. Reload and try again.");
	expect(screen.getByText("before")).toBeInTheDocument();
	act(() => {
		resolve();
	});
	await screen.findByText("changed elsewhere");
});

describe("mutation feedback", () => {
	it("expires the Undo offer after six seconds", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		renderIntegrationPage(<Probe />, { path: "/", queryClient });
		await submit();
		await screen.findByRole("button", { name: undoName });
		act(() => {
			vi.advanceTimersByTime(5900);
		});
		expect(screen.getByRole("button", { name: undoName })).toBeInTheDocument();
		act(() => {
			vi.advanceTimersByTime(200);
		});
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: undoName })
			).not.toBeInTheDocument()
		);
	});
	it("sends a compensating request when Undo is selected", async () => {
		renderIntegrationPage(<Probe />, { path: "/", queryClient });
		await submit();
		fireEvent.click(await screen.findByRole("button", { name: undoName }));
		await screen.findByText("Change undone");
		expect(value).toBe("before");
	});
	it("does not revert the saved value if the inverse is rejected", async () => {
		failUndo = true;
		renderIntegrationPage(<Probe />, { path: "/", queryClient });
		await submit();
		fireEvent.click(await screen.findByRole("button", { name: undoName }));
		await screen.findByText("Couldn't undo");
		expect(value).toBe("after");
		expect(
			screen.queryByRole("button", { name: undoName })
		).not.toBeInTheDocument();
	});
	it("does not offer Undo for destructive changes", async () => {
		renderIntegrationPage(<Probe destructive />, { path: "/", queryClient });
		await submit();
		await screen.findByText("Record deleted");
		expect(
			screen.queryByRole("button", { name: undoName })
		).not.toBeInTheDocument();
	});
	it("retains the form input after failure and closes only after retry succeeds", async () => {
		failSave = true;
		renderIntegrationPage(<Probe />, { path: "/", queryClient });
		await submit("typed value");
		await screen.findByText("Couldn't save changes");
		expect(screen.getByLabelText("Name")).toHaveValue("typed value");
		failSave = false;
		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(value).toBe("typed value");
	});
});
