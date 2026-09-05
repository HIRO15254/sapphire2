import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trpcKeys } from "@/__tests__/trpc-keys";
import { AssignRingGameDialog } from "@/features/live-sessions/components/assign-ring-game-dialog/assign-ring-game-dialog";

const ASSIGN_BUTTON_RE = /^Assign$/;
const ASSIGNING_BUTTON_RE = /^Assigning\.\.\.$/;

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const mocks = vi.hoisted(() => ({
	roomList: vi.fn(),
	ringGamesByRoom: vi.fn(),
	updateCashSession: vi.fn(),
	createAndAssignRingGame: vi.fn(),
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
		ringGame: {
			listByRoom: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("ringGame", "listByRoom", input),
					queryFn: () => mocks.ringGamesByRoom(input),
				}),
			},
		},
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
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
		liveCashGameSession: {
			update: { mutate: mocks.updateCashSession },
			createAndAssignRingGame: { mutate: mocks.createAndAssignRingGame },
		},
	},
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/features/rooms/components/ring-game-form", () => ({
	RingGameForm: ({
		formId,
		onSubmit,
	}: {
		formId: string;
		onSubmit: (values: unknown) => void;
	}) => (
		<form
			id={formId}
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit({
					name: "1/2 NLH",
					variant: "nlh",
					blind1: 1,
					blind2: 2,
					anteType: "none",
					tableSize: 9,
					minBuyIn: 40,
					maxBuyIn: 200,
					currencyId: "c1",
				});
			}}
		>
			<span data-testid="ring-game-form" />
		</form>
	),
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
		(
			<QueryClientProvider client={qc}>
				<AssignRingGameDialog
					onOpenChange={onOpenChange}
					open={open}
					sessionId={sessionId}
					sessionRoomId={sessionRoomId}
				/>
			</QueryClientProvider>
		) as ReactNode
	);
	return { onOpenChange, qc };
}

describe("AssignRingGameDialog", () => {
	beforeEach(() => {
		for (const m of Object.values(mocks)) {
			m.mockReset();
		}
		mocks.roomList.mockResolvedValue([{ id: "room-b", name: "Room B" }]);
		mocks.ringGamesByRoom.mockResolvedValue([{ id: "rg1", name: "1/2 NLH" }]);
	});

	it("renders nothing when closed", () => {
		renderDialog({ open: false });
		expect(
			screen.queryByRole("heading", { name: "Assign Ring Game" })
		).not.toBeInTheDocument();
	});

	it("renders the title and a Cancel button", () => {
		renderDialog();
		expect(
			screen.getByRole("heading", { name: "Assign Ring Game" })
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
		expect(screen.getByTestId("ring-game-form")).toBeInTheDocument();
	});

	it("hides the Room field when sessionRoomId is provided", () => {
		renderDialog({ sessionRoomId: "room-a" });
		expect(screen.queryByText("Room")).not.toBeInTheDocument();
	});

	it("shows the Room field when sessionRoomId is null", () => {
		renderDialog({ sessionRoomId: null });
		expect(screen.getByText("Room")).toBeInTheDocument();
	});

	it("submits the picked ring game via the existing tab's Assign button", async () => {
		const user = userEvent.setup();
		mocks.updateCashSession.mockResolvedValue({ id: "s1" });
		const { onOpenChange } = renderDialog();

		const [combobox] = await screen.findAllByRole("combobox");
		await user.click(combobox);
		await user.click(screen.getByRole("option", { name: "1/2 NLH" }));
		await user.click(screen.getByRole("button", { name: ASSIGN_BUTTON_RE }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(mocks.updateCashSession).toHaveBeenCalledTimes(1);
		expect(mocks.updateCashSession).toHaveBeenNthCalledWith(1, {
			id: "s1",
			ringGameId: "rg1",
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith("Game assigned");
	});

	it("submits the create-new tab's form via the external Save button", async () => {
		const user = userEvent.setup();
		mocks.createAndAssignRingGame.mockResolvedValue({
			sessionId: "s1",
			ringGameId: "new-rg",
		});
		const { onOpenChange } = renderDialog();

		await user.click(screen.getByRole("button", { name: "Create new" }));
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(mocks.createAndAssignRingGame).toHaveBeenCalledTimes(1);
		expect(mocks.createAndAssignRingGame).toHaveBeenNthCalledWith(1, {
			sessionId: "s1",
			roomId: "room-a",
			name: "1/2 NLH",
			variant: "nlh",
			blind1: 1,
			blind2: 2,
			anteType: "none",
			tableSize: 9,
			minBuyIn: 40,
			maxBuyIn: 200,
			currencyId: "c1",
		});
		expect(mocks.toastSuccess).toHaveBeenCalledWith(
			"Game created and assigned"
		);
	});

	it("does not close the sheet from Cancel while the assign mutation is pending", async () => {
		const user = userEvent.setup();
		mocks.updateCashSession.mockReturnValue(new Promise(() => undefined));
		const { onOpenChange } = renderDialog();

		const [combobox] = await screen.findAllByRole("combobox");
		await user.click(combobox);
		await user.click(screen.getByRole("option", { name: "1/2 NLH" }));
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
