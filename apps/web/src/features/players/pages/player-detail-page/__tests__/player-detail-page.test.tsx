import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	usePlayerDetailPage: vi.fn(),
}));

vi.mock(
	"@/features/players/pages/player-detail-page/use-player-detail-page",
	() => ({
		usePlayerDetailPage: hoisted.usePlayerDetailPage,
	})
);

vi.mock("@/features/players/pages/player-detail-page/top-bar", () => ({
	TopBar: ({ onOpenActions }: { onOpenActions?: () => void }) => (
		<button onClick={onOpenActions} type="button">
			stub-open-actions
		</button>
	),
}));

vi.mock(
	"@/features/players/pages/player-detail-page/player-actions-drawer",
	() => ({
		PlayerActionsDrawer: ({ open }: { open: boolean }) =>
			open ? <div data-testid="actions-drawer" /> : null,
	})
);

vi.mock(
	"@/features/players/pages/player-detail-page/delete-player-dialog",
	() => ({
		DeletePlayerDialog: ({
			open,
			playerName,
		}: {
			open: boolean;
			playerName: string;
		}) => (open ? <div data-testid="delete-dialog">{playerName}</div> : null),
	})
);

vi.mock("@/features/players/components/player-form", () => ({
	PlayerForm: () => <div data-testid="player-form-stub" />,
}));

vi.mock("@/shared/components/ui/rich-text-content", () => ({
	RichTextContent: ({ html }: { html: string }) => (
		<div data-testid="memo-html">{html}</div>
	),
}));

import { PlayerDetailPage } from "@/features/players/pages/player-detail-page/player-detail-page";

interface MockPlayer {
	id: string;
	memo: string | null;
	name: string;
	tags: Array<{ color: string; id: string; name: string }>;
}

interface MockState {
	availableTags: Array<{ color: string; id: string; name: string }>;
	confirmingDelete: boolean;
	createTag: ReturnType<typeof vi.fn>;
	handleConfirmDelete: ReturnType<typeof vi.fn>;
	handleEdit: ReturnType<typeof vi.fn>;
	isActionsOpen: boolean;
	isEditOpen: boolean;
	isInitialLoadError: boolean;
	isLoading: boolean;
	isSaving: boolean;
	onRetry: ReturnType<typeof vi.fn>;
	openDeleteFromActions: ReturnType<typeof vi.fn>;
	openEditFromActions: ReturnType<typeof vi.fn>;
	player: MockPlayer | null;
	setConfirmingDelete: ReturnType<typeof vi.fn>;
	setIsActionsOpen: ReturnType<typeof vi.fn>;
	setIsEditOpen: ReturnType<typeof vi.fn>;
}

type MountFlag = "confirmingDelete" | "isActionsOpen" | "isEditOpen";

function setMockState(overrides: Partial<MockState> = {}): MockState {
	const state: MockState = {
		player: {
			id: "p1",
			name: "Alice",
			memo: null,
			tags: [],
		},
		availableTags: [],
		createTag: vi.fn(),
		isLoading: false,
		isInitialLoadError: false,
		onRetry: vi.fn(),
		isSaving: false,
		isActionsOpen: false,
		isEditOpen: false,
		confirmingDelete: false,
		setIsActionsOpen: vi.fn(),
		setIsEditOpen: vi.fn(),
		setConfirmingDelete: vi.fn(),
		openEditFromActions: vi.fn(),
		openDeleteFromActions: vi.fn(),
		handleEdit: vi.fn(),
		handleConfirmDelete: vi.fn(),
		...overrides,
	};
	hoisted.usePlayerDetailPage.mockReturnValue(state);
	return state;
}

describe("PlayerDetailPage", () => {
	beforeEach(() => {
		hoisted.usePlayerDetailPage.mockReset();
	});

	it("renders the skeleton and no top bar while loading", () => {
		setMockState({ isLoading: true, player: null });
		render(<PlayerDetailPage playerId="p1" />);
		expect(screen.getByTestId("player-detail-skeleton")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "stub-open-actions" })
		).not.toBeInTheDocument();
	});

	it("shows a retryable error instead of not-found when the initial query fails", () => {
		const onRetry = vi.fn();
		setMockState({ player: null, isInitialLoadError: true, onRetry });
		render(<PlayerDetailPage playerId="p1" />);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load player. Please try again."
		);
		expect(
			screen.queryByRole("heading", { name: "Player not found" })
		).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("renders the not-found message when the player is null and not loading", () => {
		setMockState({ isLoading: false, player: null });
		render(<PlayerDetailPage playerId="p1" />);
		expect(
			screen.getByRole("heading", { name: "Player not found" })
		).toBeInTheDocument();
		expect(
			screen.getByText("This player may have been deleted.")
		).toBeInTheDocument();
	});

	it("renders the player name as the heading once loaded", () => {
		setMockState({
			player: { id: "p1", name: "Carol", memo: null, tags: [] },
		});
		render(<PlayerDetailPage playerId="p1" />);
		expect(screen.getByRole("heading", { name: "Carol" })).toBeInTheDocument();
	});

	it("opens the actions drawer from the TopBar", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<PlayerDetailPage playerId="p1" />);
		await user.click(screen.getByRole("button", { name: "stub-open-actions" }));
		expect(state.setIsActionsOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsActionsOpen).toHaveBeenCalledWith(true);
	});

	it("renders one badge per tag", () => {
		setMockState({
			player: {
				id: "p1",
				name: "Carol",
				memo: null,
				tags: [
					{ id: "vip", name: "VIP", color: "blue" },
					{ id: "reg", name: "Regular", color: "red" },
				],
			},
		});
		render(<PlayerDetailPage playerId="p1" />);
		expect(screen.getByText("VIP")).toBeInTheDocument();
		expect(screen.getByText("Regular")).toBeInTheDocument();
	});

	it("renders the memo html when present and the placeholder when null", () => {
		setMockState({
			player: {
				id: "p1",
				name: "Carol",
				memo: "<p>Tough regular</p>",
				tags: [],
			},
		});
		const { rerender } = render(<PlayerDetailPage playerId="p1" />);
		expect(screen.getByTestId("memo-html")).toHaveTextContent("Tough regular");
		expect(screen.queryByText("No memo yet.")).not.toBeInTheDocument();
		setMockState({
			player: { id: "p1", name: "Carol", memo: null, tags: [] },
		});
		rerender(<PlayerDetailPage playerId="p1" />);
		expect(screen.getByText("No memo yet.")).toBeInTheDocument();
		expect(screen.queryByTestId("memo-html")).not.toBeInTheDocument();
	});

	it.each<[string, MountFlag, string]>([
		["edit form", "isEditOpen", "player-form-stub"],
		["actions drawer", "isActionsOpen", "actions-drawer"],
		["delete dialog", "confirmingDelete", "delete-dialog"],
	])("mounts the %s only while %s is true", (_, flag, testId) => {
		setMockState({ [flag]: false });
		const { rerender } = render(<PlayerDetailPage playerId="p1" />);
		expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
		setMockState({ [flag]: true });
		rerender(<PlayerDetailPage playerId="p1" />);
		expect(screen.getByTestId(testId)).toBeInTheDocument();
	});

	it("disables the edit sheet Save button while isSaving is true", () => {
		setMockState({ isEditOpen: true, isSaving: true });
		render(<PlayerDetailPage playerId="p1" />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});

	it("passes the player name to the delete dialog", () => {
		setMockState({
			confirmingDelete: true,
			player: { id: "p1", name: "Dave", memo: null, tags: [] },
		});
		render(<PlayerDetailPage playerId="p1" />);
		expect(screen.getByTestId("delete-dialog")).toHaveTextContent("Dave");
	});
});
