import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	useRoomDetailPage: vi.fn(),
}));

vi.mock("@/features/rooms/pages/room-detail-page/use-room-detail-page", () => ({
	useRoomDetailPage: hoisted.useRoomDetailPage,
}));

vi.mock("@/features/rooms/pages/room-detail-page/ring-game-tab", () => ({
	RingGameTab: ({ roomId }: { roomId: string }) => (
		<div data-testid="ring-game-tab">{roomId}</div>
	),
}));

vi.mock("@/features/rooms/pages/room-detail-page/tournament-tab", () => ({
	TournamentTab: ({ roomId }: { roomId: string }) => (
		<div data-testid="tournament-tab">{roomId}</div>
	),
}));

vi.mock("@/features/rooms/components/room-form", () => ({
	RoomForm: () => <div data-testid="room-form" />,
}));

vi.mock("@/features/rooms/pages/room-detail-page/room-actions-drawer", () => ({
	RoomActionsDrawer: ({
		open,
		onDelete,
		onEdit,
		onToggleFavorite,
	}: {
		onDelete: () => void;
		onEdit: () => void;
		onToggleFavorite: () => void;
		open: boolean;
	}) =>
		open ? (
			<div data-testid="room-actions">
				<button onClick={onToggleFavorite} type="button">
					drawer-toggle-fav
				</button>
				<button onClick={onEdit} type="button">
					drawer-edit
				</button>
				<button onClick={onDelete} type="button">
					drawer-delete
				</button>
			</div>
		) : null,
}));

vi.mock("@/features/rooms/pages/room-detail-page/delete-room-dialog", () => ({
	DeleteRoomDialog: ({
		open,
		roomName,
	}: {
		open: boolean;
		roomName: string;
	}) => (open ? <div data-testid="delete-room-dialog">{roomName}</div> : null),
}));

// Stub the back-link TopBar so the page test needs no router context.
vi.mock("@/features/rooms/pages/room-detail-page/top-bar", () => ({
	TopBar: ({ onOpenActions }: { onOpenActions?: () => void }) => (
		<button onClick={onOpenActions} type="button">
			top-bar-actions
		</button>
	),
}));

import { RoomDetailPage } from "@/features/rooms/pages/room-detail-page/room-detail-page";

interface State {
	confirmingDelete: boolean;
	handleConfirmDelete: ReturnType<typeof vi.fn>;
	handleEdit: ReturnType<typeof vi.fn>;
	handleToggleFavorite: ReturnType<typeof vi.fn>;
	isActionsOpen: boolean;
	isEditOpen: boolean;
	isInitialLoadError: boolean;
	isLoading: boolean;
	isUpdatePending: boolean;
	onRetry: ReturnType<typeof vi.fn>;
	openDeleteFromActions: ReturnType<typeof vi.fn>;
	openEditFromActions: ReturnType<typeof vi.fn>;
	room: { isFavorite?: boolean; memo?: string | null; name: string } | null;
	setConfirmingDelete: ReturnType<typeof vi.fn>;
	setIsActionsOpen: ReturnType<typeof vi.fn>;
	setIsEditOpen: ReturnType<typeof vi.fn>;
}

function setState(overrides: Partial<State> = {}): State {
	const state: State = {
		room: { name: "Akiba", memo: "late nights", isFavorite: false },
		isInitialLoadError: false,
		isLoading: false,
		isUpdatePending: false,
		onRetry: vi.fn(),
		isActionsOpen: false,
		isEditOpen: false,
		confirmingDelete: false,
		setIsActionsOpen: vi.fn(),
		setIsEditOpen: vi.fn(),
		setConfirmingDelete: vi.fn(),
		handleToggleFavorite: vi.fn(),
		openEditFromActions: vi.fn(),
		openDeleteFromActions: vi.fn(),
		handleEdit: vi.fn(),
		handleConfirmDelete: vi.fn(),
		...overrides,
	};
	hoisted.useRoomDetailPage.mockReturnValue(state);
	return state;
}

describe("RoomDetailPage", () => {
	beforeEach(() => {
		hoisted.useRoomDetailPage.mockReset();
	});

	it("renders the skeleton while loading", () => {
		setState({ isLoading: true });
		render(<RoomDetailPage roomId="s1" />);
		expect(screen.getByTestId("room-detail-skeleton")).toBeInTheDocument();
	});

	it("shows an error and retries when the initial room query fails", async () => {
		const user = userEvent.setup();
		const state = setState({
			isInitialLoadError: true,
			isLoading: false,
			room: null,
		});
		render(<RoomDetailPage roomId="s1" />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load room. Please try again."
		);
		expect(
			screen.queryByRole("heading", { name: "Room not found" })
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Retry" }));
		expect(state.onRetry).toHaveBeenCalledTimes(1);
	});

	it("keeps a cached room visible after a refetch failure", () => {
		setState({ isInitialLoadError: false });
		render(<RoomDetailPage roomId="s1" />);

		expect(screen.getByRole("heading", { name: "Akiba" })).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("renders a not-found message when the room is missing", () => {
		setState({ room: null, isLoading: false });
		render(<RoomDetailPage roomId="s1" />);
		expect(
			screen.getByRole("heading", { name: "Room not found" })
		).toBeInTheDocument();
	});

	it("keeps the room heading accessible name separate from the favorite action", () => {
		setState();
		render(<RoomDetailPage roomId="s1" />);
		expect(screen.getByRole("heading", { name: "Akiba" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Add to favorites" })
		).toBeVisible();
		expect(screen.getByText("late nights")).toBeInTheDocument();
	});

	it("renders the 'Add to favorites' star button in the header when isFavorite is false", () => {
		setState({ room: { name: "Akiba", memo: null, isFavorite: false } });
		render(<RoomDetailPage roomId="s1" />);
		expect(screen.getByLabelText("Add to favorites")).toBeInTheDocument();
	});

	it("renders the 'Remove from favorites' star button in the header when isFavorite is true", () => {
		setState({ room: { name: "Akiba", memo: null, isFavorite: true } });
		render(<RoomDetailPage roomId="s1" />);
		expect(screen.getByLabelText("Remove from favorites")).toBeInTheDocument();
	});

	it("calls handleToggleFavorite when the header star button is clicked", async () => {
		const user = userEvent.setup();
		const state = setState({
			room: { name: "Akiba", memo: null, isFavorite: false },
		});
		render(<RoomDetailPage roomId="s1" />);
		await user.click(screen.getByLabelText("Add to favorites"));
		expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
	});

	it("renders the cash-games tab content with the room id", () => {
		setState();
		render(<RoomDetailPage roomId="room-42" />);
		expect(screen.getByTestId("ring-game-tab")).toHaveTextContent("room-42");
	});

	it("opens the actions drawer from the top bar", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<RoomDetailPage roomId="s1" />);
		await user.click(screen.getByRole("button", { name: "top-bar-actions" }));
		expect(state.setIsActionsOpen).toHaveBeenCalledWith(true);
	});

	it("wires the actions drawer to edit and delete handlers", async () => {
		const user = userEvent.setup();
		const state = setState({ isActionsOpen: true });
		render(<RoomDetailPage roomId="s1" />);
		await user.click(screen.getByRole("button", { name: "drawer-edit" }));
		expect(state.openEditFromActions).toHaveBeenCalledTimes(1);
		await user.click(screen.getByRole("button", { name: "drawer-delete" }));
		expect(state.openDeleteFromActions).toHaveBeenCalledTimes(1);
	});

	it("wires the actions drawer toggle-favorite button to handleToggleFavorite", async () => {
		const user = userEvent.setup();
		const state = setState({ isActionsOpen: true });
		render(<RoomDetailPage roomId="s1" />);
		await user.click(screen.getByRole("button", { name: "drawer-toggle-fav" }));
		expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
	});

	it("mounts the edit form when the edit sheet is open", () => {
		setState({ isEditOpen: true });
		render(<RoomDetailPage roomId="s1" />);
		expect(screen.getByTestId("room-form")).toBeInTheDocument();
	});

	it("shows the delete dialog with the room name when confirming", () => {
		setState({ confirmingDelete: true });
		render(<RoomDetailPage roomId="s1" />);
		expect(screen.getByTestId("delete-room-dialog")).toHaveTextContent("Akiba");
	});
});
