import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trpcKeys } from "@/__tests__/trpc-keys";
import { AssignTournamentDialog } from "@/features/live-sessions/components/assign-tournament-dialog/assign-tournament-dialog";

const ASSIGN_BUTTON_RE = /^Assign$/;
const ASSIGNING_BUTTON_RE = /^Assigning\.\.\.$/;

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const mocks = vi.hoisted(() => ({
	roomList: vi.fn(),
	tournamentsByRoom: vi.fn(),
	updateTournament: vi.fn(),
	createAndAssignTournament: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		room: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("room", "list", undefined),
					queryFn: () => mocks.roomList(),
				}),
			},
		},
		tournament: {
			listByRoom: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listByRoom", input),
					queryFn: () => mocks.tournamentsByRoom(input),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
				}),
			},
		},
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
				}),
				pathKey: () => trpcKeys.session.list.pathKey(),
			},
		},
	},
	trpcClient: {
		liveTournamentSession: {
			update: { mutate: mocks.updateTournament },
			createAndAssignTournament: {
				mutate: mocks.createAndAssignTournament,
			},
		},
	},
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/features/rooms/components/tournament-form-sheet", () => ({
	TournamentFormSheet: ({
		onSave,
		open,
		title,
	}: {
		onSave: (values: unknown, levels: unknown[]) => void;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h3>{title}</h3>
				<button
					onClick={() =>
						onSave(
							{
								name: "Main Event",
								variant: "nlh",
								buyIn: 100,
								entryFee: 10,
								startingStack: 20_000,
								tableSize: 9,
								currencyId: "c1",
								tags: [],
								chipPurchases: [],
							},
							[]
						)
					}
					type="button"
				>
					Save tournament
				</button>
			</div>
		) : null,
}));

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
}

function renderDialog({
	onOpenChange = vi.fn(),
	open = true,
	sessionId = "s1",
	sessionRoomId = "room-a" as string | null,
}: {
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	sessionId?: string;
	sessionRoomId?: string | null;
} = {}) {
	const qc = createClient();
	render(
		<QueryClientProvider client={qc}>
			<AssignTournamentDialog
				onOpenChange={onOpenChange}
				open={open}
				sessionId={sessionId}
				sessionRoomId={sessionRoomId}
			/>
		</QueryClientProvider>
	);
	return { onOpenChange, qc };
}

describe("AssignTournamentDialog", () => {
	beforeEach(() => {
		for (const m of Object.values(mocks)) {
			m.mockReset();
		}
		mocks.roomList.mockResolvedValue([{ id: "room-b", name: "Room B" }]);
		mocks.tournamentsByRoom.mockResolvedValue([
			{ id: "t1", name: "Main Event" },
		]);
	});

	it("renders nothing when closed", () => {
		renderDialog({ open: false });
		expect(
			screen.queryByRole("heading", { name: "Assign Tournament" })
		).not.toBeInTheDocument();
	});

	it("renders the title and a Cancel button", () => {
		renderDialog();
		expect(
			screen.getByRole("heading", { name: "Assign Tournament" })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
	});

	it("clicking Cancel closes the sheet when no mutation is pending", async () => {
		const user = userEvent.setup();
		const { onOpenChange } = renderDialog();
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("defaults to the Select existing tab and switches to Create new on click", async () => {
		const user = userEvent.setup();
		renderDialog();
		const existingTab = screen.getByRole("button", { name: "Select existing" });
		const createTab = screen.getByRole("button", { name: "Create new" });
		expect(existingTab).toHaveAttribute("aria-pressed", "true");
		expect(createTab).toHaveAttribute("aria-pressed", "false");

		await user.click(createTab);

		expect(existingTab).toHaveAttribute("aria-pressed", "false");
		expect(createTab).toHaveAttribute("aria-pressed", "true");
		expect(
			screen.getByRole("button", { name: "Create new tournament" })
		).toBeInTheDocument();
	});

	it("hides the Room field when sessionRoomId is provided", () => {
		renderDialog({ sessionRoomId: "room-a" });
		expect(screen.queryByText("Room")).not.toBeInTheDocument();
	});

	it("shows the Room field when sessionRoomId is null", () => {
		renderDialog({ sessionRoomId: null });
		expect(screen.getByText("Room")).toBeInTheDocument();
	});

	it("submits the picked tournament via the existing tab's Assign button", async () => {
		const user = userEvent.setup();
		mocks.updateTournament.mockResolvedValue({ id: "s1" });
		const { onOpenChange } = renderDialog();

		const [combobox] = await screen.findAllByRole("combobox");
		await user.click(combobox);
		await user.click(screen.getByRole("option", { name: "Main Event" }));
		await user.click(screen.getByRole("button", { name: ASSIGN_BUTTON_RE }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(mocks.updateTournament).toHaveBeenCalledTimes(1);
		expect(mocks.updateTournament).toHaveBeenNthCalledWith(1, {
			id: "s1",
			tournamentId: "t1",
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Tournament assigned");
	});

	it("opens the nested TournamentFormSheet from the create tab and submits it", async () => {
		const user = userEvent.setup();
		mocks.createAndAssignTournament.mockResolvedValue({
			sessionId: "s1",
			tournamentId: "new-t",
		});
		const { onOpenChange } = renderDialog();

		await user.click(screen.getByRole("button", { name: "Create new" }));
		await user.click(
			screen.getByRole("button", { name: "Create new tournament" })
		);
		expect(
			screen.getByRole("heading", { hidden: true, name: "New Tournament" })
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole("button", { hidden: true, name: "Save tournament" })
		);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(mocks.createAndAssignTournament).toHaveBeenCalledTimes(1);
		expect(mocks.createAndAssignTournament).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				sessionId: "s1",
				roomId: "room-a",
				name: "Main Event",
			})
		);
		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			"Tournament created and assigned"
		);
		expect(
			screen.queryByRole("heading", { name: "New Tournament" })
		).not.toBeInTheDocument();
	});

	it("does not close the sheet from Cancel while the assign mutation is pending", async () => {
		const user = userEvent.setup();
		mocks.updateTournament.mockReturnValue(new Promise(() => undefined));
		const { onOpenChange } = renderDialog();

		const [combobox] = await screen.findAllByRole("combobox");
		await user.click(combobox);
		await user.click(screen.getByRole("option", { name: "Main Event" }));
		await user.click(screen.getByRole("button", { name: ASSIGN_BUTTON_RE }));

		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: ASSIGNING_BUTTON_RE })
			).toBeInTheDocument()
		);
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onOpenChange).not.toHaveBeenCalled();
	});
});
