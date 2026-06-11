import { render, screen } from "@testing-library/react";
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
		<div
			data-has-actions={String(Boolean(onOpenActions))}
			data-testid="top-bar"
		/>
	),
}));

vi.mock("@/features/players/components/player-actions-drawer", () => ({
	PlayerActionsDrawer: ({ open }: { open: boolean }) =>
		open ? <div data-testid="actions-drawer" /> : null,
}));

vi.mock("@/features/players/components/delete-player-dialog", () => ({
	DeletePlayerDialog: ({
		open,
		playerName,
	}: {
		open: boolean;
		playerName: string;
	}) => (open ? <div data-testid="delete-dialog">{playerName}</div> : null),
}));

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
	isLoading: boolean;
	isSaving: boolean;
	openDeleteFromActions: ReturnType<typeof vi.fn>;
	openEditFromActions: ReturnType<typeof vi.fn>;
	player: MockPlayer | null;
	setConfirmingDelete: ReturnType<typeof vi.fn>;
	setIsActionsOpen: ReturnType<typeof vi.fn>;
	setIsEditOpen: ReturnType<typeof vi.fn>;
}

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

	describe("loading branch", () => {
		it("renders the skeleton and no header while loading", () => {
			setMockState({ isLoading: true, player: null });
			render(<PlayerDetailPage playerId="p1" />);
			expect(screen.getByTestId("player-detail-skeleton")).toBeInTheDocument();
			expect(screen.queryByTestId("top-bar")).not.toBeInTheDocument();
		});
	});

	describe("not-found branch", () => {
		it("renders the not-found message when player is null and not loading", () => {
			setMockState({ isLoading: false, player: null });
			render(<PlayerDetailPage playerId="p1" />);
			expect(
				screen.getByRole("heading", { name: "Player not found" })
			).toBeInTheDocument();
			expect(
				screen.getByText("This player may have been deleted.")
			).toBeInTheDocument();
		});
	});

	describe("content branch", () => {
		it("renders the player name in the header", () => {
			setMockState({
				player: { id: "p1", name: "Carol", memo: null, tags: [] },
			});
			render(<PlayerDetailPage playerId="p1" />);
			expect(
				screen.getByRole("heading", { name: "Carol" })
			).toBeInTheDocument();
		});

		it("renders each tag", () => {
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

		it("renders the memo content when a memo is present", () => {
			setMockState({
				player: {
					id: "p1",
					name: "Carol",
					memo: "<p>Tough regular</p>",
					tags: [],
				},
			});
			render(<PlayerDetailPage playerId="p1" />);
			expect(screen.getByTestId("memo-html")).toHaveTextContent(
				"Tough regular"
			);
		});

		it("renders the empty-memo placeholder when memo is null", () => {
			setMockState({
				player: { id: "p1", name: "Carol", memo: null, tags: [] },
			});
			render(<PlayerDetailPage playerId="p1" />);
			expect(screen.getByText("No memo yet.")).toBeInTheDocument();
			expect(screen.queryByTestId("memo-html")).not.toBeInTheDocument();
		});

		it("passes onOpenActions to the TopBar in the content branch", () => {
			setMockState();
			render(<PlayerDetailPage playerId="p1" />);
			expect(screen.getByTestId("top-bar")).toHaveAttribute(
				"data-has-actions",
				"true"
			);
		});

		it("mounts the edit form only when isEditOpen is true", () => {
			setMockState({ isEditOpen: true });
			render(<PlayerDetailPage playerId="p1" />);
			expect(screen.getByTestId("player-form-stub")).toBeInTheDocument();
		});

		it("does not mount the edit form when isEditOpen is false", () => {
			setMockState({ isEditOpen: false });
			render(<PlayerDetailPage playerId="p1" />);
			expect(screen.queryByTestId("player-form-stub")).not.toBeInTheDocument();
		});

		it("disables the edit FormSheet Save button while isSaving is true", () => {
			setMockState({ isEditOpen: true, isSaving: true });
			render(<PlayerDetailPage playerId="p1" />);
			expect(screen.getByLabelText("Save")).toBeDisabled();
		});

		it("shows the delete dialog with the player name when confirming", () => {
			setMockState({
				confirmingDelete: true,
				player: { id: "p1", name: "Dave", memo: null, tags: [] },
			});
			render(<PlayerDetailPage playerId="p1" />);
			expect(screen.getByTestId("delete-dialog")).toHaveTextContent("Dave");
		});
	});
});
