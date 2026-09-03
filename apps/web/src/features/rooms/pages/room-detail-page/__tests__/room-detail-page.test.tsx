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
	RoomForm: ({ onSubmit }: { onSubmit: (values: unknown) => void }) => (
		<button
			data-testid="room-form"
			onClick={() => onSubmit({ name: "Akiba 2" })}
			type="button"
		>
			room-form-submit
		</button>
	),
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
				<button onClick={() => onEdit()} type="button">
					drawer-edit
				</button>
				<button onClick={() => onDelete()} type="button">
					drawer-delete
				</button>
			</div>
		) : null,
}));

vi.mock("@/features/rooms/pages/room-detail-page/delete-room-dialog", () => ({
	DeleteRoomDialog: ({
		onConfirm,
		open,
		roomName,
	}: {
		onConfirm: () => void;
		open: boolean;
		roomName: string;
	}) =>
		open ? (
			<div data-testid="delete-room-dialog">
				{roomName}
				<button onClick={() => onConfirm()} type="button">
					dialog-confirm
				</button>
			</div>
		) : null,
}));

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

	it("renders a not-found message when the room is missing", () => {
		setState({ room: null, isLoading: false });
		render(<RoomDetailPage roomId="s1" />);
		expect(
			screen.getByRole("heading", { name: "Room not found" })
		).toBeInTheDocument();
		expect(
			screen.getByText("This room may have been deleted.")
		).toBeInTheDocument();
	});

	it("renders the loaded room's heading, memo, and tabs fed with the room id", () => {
		setState();
		render(<RoomDetailPage roomId="room-42" />);
		expect(screen.getByRole("heading", { name: "Akiba" })).toBeInTheDocument();
		expect(screen.getByText("late nights")).toBeInTheDocument();
		expect(screen.getByTestId("ring-game-tab")).toHaveTextContent("room-42");
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("labels the header star by the room's favorite state", () => {
		setState({ room: { name: "Akiba", memo: null, isFavorite: false } });
		const { rerender } = render(<RoomDetailPage roomId="s1" />);
		expect(
			screen.getByRole("button", { name: "Add to favorites" })
		).toBeVisible();

		setState({ room: { name: "Akiba", memo: null, isFavorite: true } });
		rerender(<RoomDetailPage roomId="s1" />);
		expect(
			screen.getByRole("button", { name: "Remove from favorites" })
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Add to favorites" })
		).not.toBeInTheDocument();
	});

	it.each([
		["the header star", "Add to favorites", {}],
		["the actions drawer", "drawer-toggle-fav", { isActionsOpen: true }],
	])("routes %s to handleToggleFavorite", async (_entry, name, overrides: Partial<State>) => {
		const user = userEvent.setup();
		const state = setState(overrides);
		render(<RoomDetailPage roomId="s1" />);
		await user.click(screen.getByRole("button", { name }));
		expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
	});

	it.each([
		["top-bar-actions", "setIsActionsOpen", {}, [true]],
		["drawer-edit", "openEditFromActions", { isActionsOpen: true }, []],
		["drawer-delete", "openDeleteFromActions", { isActionsOpen: true }, []],
		[
			"room-form-submit",
			"handleEdit",
			{ isEditOpen: true },
			[{ name: "Akiba 2" }],
		],
		["dialog-confirm", "handleConfirmDelete", { confirmingDelete: true }, []],
	] as const)("routes %s to %s", async (name, handler, overrides: Partial<State>, args) => {
		const user = userEvent.setup();
		const state = setState(overrides);
		render(<RoomDetailPage roomId="s1" />);
		await user.click(screen.getByRole("button", { name }));
		expect(state[handler]).toHaveBeenCalledTimes(1);
		expect(state[handler]).toHaveBeenCalledWith(...args);
	});

	it("mounts the edit form only while the edit sheet is open", () => {
		setState({ isEditOpen: false });
		const { rerender } = render(<RoomDetailPage roomId="s1" />);
		expect(screen.queryByTestId("room-form")).not.toBeInTheDocument();

		setState({ isEditOpen: true });
		rerender(<RoomDetailPage roomId="s1" />);
		expect(screen.getByTestId("room-form")).toBeInTheDocument();
	});

	it("disables the edit sheet's Save button while the update is pending", () => {
		setState({ isEditOpen: true, isUpdatePending: true });
		render(<RoomDetailPage roomId="s1" />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});

	it("shows the delete dialog with the room name only while confirming", () => {
		setState({ confirmingDelete: false });
		const { rerender } = render(<RoomDetailPage roomId="s1" />);
		expect(screen.queryByTestId("delete-room-dialog")).not.toBeInTheDocument();

		setState({ confirmingDelete: true });
		rerender(<RoomDetailPage roomId="s1" />);
		expect(screen.getByTestId("delete-room-dialog")).toHaveTextContent("Akiba");
	});
});
