import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	latestVersion: "v3.2.2" as string | null,
	viewedList: [] as Array<{ id: string; version: string; viewedAt: number }>,
	hang: false,
}));

vi.mock("@/features/update-notes/constants", () => ({
	get LATEST_VERSION() {
		return state.latestVersion;
	},
	UPDATE_NOTES: [],
}));

const listKey = ["updateNoteView", "list"];

vi.mock("@/utils/trpc", () => ({
	trpc: {
		updateNoteView: {
			list: {
				queryOptions: () => ({
					queryKey: listKey,
					queryFn: () =>
						state.hang
							? new Promise(() => {
									/* never resolves — simulates the loading state */
								})
							: Promise.resolve(state.viewedList),
				}),
			},
		},
	},
}));

import {
	UpdateNotesProvider,
	useUpdateNotesSheet,
} from "@/features/update-notes/components/update-notes-sheet/use-update-notes-sheet";

function Probe() {
	const { isOpen, close } = useUpdateNotesSheet();
	return (
		<div>
			<span data-testid="state">{isOpen ? "open" : "closed"}</span>
			<button onClick={close} type="button">
				close
			</button>
		</div>
	);
}

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
		},
	});
}

function renderProvider(client: QueryClient) {
	return render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(UpdateNotesProvider, null, createElement(Probe))
		) as ReactNode
	);
}

describe("UpdateNotesProvider auto-open", () => {
	beforeEach(() => {
		state.latestVersion = "v3.2.2";
		state.viewedList = [];
		state.hang = false;
	});

	it("auto-opens for a user with no view records once the list loads", async () => {
		state.viewedList = [];
		const qc = createClient();
		renderProvider(qc);

		await waitFor(() =>
			expect(screen.getByTestId("state")).toHaveTextContent("open")
		);
	});

	it("auto-opens when the user has viewed older versions but not the latest", async () => {
		state.viewedList = [
			{ id: "1", version: "v3.2.1", viewedAt: 2 },
			{ id: "2", version: "v3.2.0", viewedAt: 1 },
		];
		const qc = createClient();
		renderProvider(qc);

		await waitFor(() =>
			expect(screen.getByTestId("state")).toHaveTextContent("open")
		);
	});

	it("stays closed when the user has already viewed the latest version", () => {
		state.viewedList = [{ id: "1", version: "v3.2.2", viewedAt: 1 }];
		const qc = createClient();
		qc.setQueryData(listKey, state.viewedList);
		renderProvider(qc);

		// Data is seeded synchronously, so the auto-open effect has already run.
		expect(screen.getByTestId("state")).toHaveTextContent("closed");
	});

	it("stays closed while the list is still loading (no flash-open before data)", async () => {
		state.viewedList = [];
		state.hang = true;
		const qc = createClient();
		renderProvider(qc);

		// The list never resolves; even though an empty list would open once
		// loaded, the loading guard keeps it closed.
		await waitFor(() =>
			expect(screen.getByTestId("state")).toHaveTextContent("closed")
		);
	});

	it("stays closed when there is no published release (LATEST_VERSION null)", () => {
		state.latestVersion = null;
		state.viewedList = [];
		const qc = createClient();
		qc.setQueryData(listKey, state.viewedList);
		renderProvider(qc);

		expect(screen.getByTestId("state")).toHaveTextContent("closed");
	});

	it("auto-opens only once — does not reopen after the user closes it and the list refetches", async () => {
		state.viewedList = [];
		const qc = createClient();
		qc.setQueryData(listKey, state.viewedList);
		renderProvider(qc);

		expect(screen.getByTestId("state")).toHaveTextContent("open");

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "close" }));
		expect(screen.getByTestId("state")).toHaveTextContent("closed");

		// A later cache update (e.g. after marking a note viewed) must not
		// re-trigger the one-shot auto-open.
		qc.setQueryData(listKey, [{ id: "1", version: "v3.2.2", viewedAt: 1 }]);

		await waitFor(() =>
			expect(screen.getByTestId("state")).toHaveTextContent("closed")
		);
	});
});
