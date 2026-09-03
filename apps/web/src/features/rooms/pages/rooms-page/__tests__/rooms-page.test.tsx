import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEW_STORE_RE = /New room/i;

const hoisted = vi.hoisted(() => ({
	useRoomsPage: vi.fn(),
}));

vi.mock("@/features/rooms/pages/rooms-page/use-rooms-page", () => ({
	useRoomsPage: hoisted.useRoomsPage,
}));

vi.mock("@/features/rooms/pages/rooms-page/room-list", () => ({
	RoomList: ({
		rooms,
		onCreate,
		onToggleFavorite,
	}: {
		rooms: { id: string }[];
		onCreate: () => void;
		onToggleFavorite: (id: string) => void;
	}) => (
		<div data-count={rooms.length} data-testid="room-list-stub">
			<button onClick={onCreate} type="button">
				stub-create
			</button>
			<button onClick={() => onToggleFavorite("s1")} type="button">
				stub-toggle-fav
			</button>
		</div>
	),
}));

vi.mock("@/features/rooms/components/room-form", () => ({
	RoomForm: ({ onSubmit }: { onSubmit: (values: unknown) => void }) => (
		<button
			data-testid="room-form-stub"
			onClick={() => onSubmit({ name: "Akiba" })}
			type="button"
		>
			stub-submit
		</button>
	),
}));

import { RoomsPage } from "@/features/rooms/pages/rooms-page/rooms-page";

interface MockState {
	handleCreate: ReturnType<typeof vi.fn>;
	handleToggleFavorite: ReturnType<typeof vi.fn>;
	isCreateOpen: boolean;
	isCreatePending: boolean;
	isError: boolean;
	isLoading: boolean;
	onRetry: ReturnType<typeof vi.fn>;
	rooms: {
		id: string;
		name: string;
		ringGameCount: number;
		tournamentCount: number;
	}[];
	setIsCreateOpen: ReturnType<typeof vi.fn>;
}

function setMockState(overrides: Partial<MockState> = {}): MockState {
	const state: MockState = {
		rooms: [],
		isCreateOpen: false,
		isCreatePending: false,
		isError: false,
		isLoading: false,
		onRetry: vi.fn(),
		setIsCreateOpen: vi.fn(),
		handleCreate: vi.fn(),
		handleToggleFavorite: vi.fn(),
		...overrides,
	};
	hoisted.useRoomsPage.mockReturnValue(state);
	return state;
}

describe("RoomsPage", () => {
	beforeEach(() => {
		hoisted.useRoomsPage.mockReset();
	});

	it("renders the Rooms heading and hands the hook's rooms to RoomList", () => {
		setMockState({
			rooms: [
				{ id: "s1", name: "Akiba", ringGameCount: 0, tournamentCount: 0 },
				{ id: "s2", name: "Shinjuku", ringGameCount: 1, tournamentCount: 2 },
			],
		});
		render(<RoomsPage />);
		expect(screen.getByRole("heading", { name: "Rooms" })).toBeInTheDocument();
		expect(screen.getByTestId("room-list-stub")).toHaveAttribute(
			"data-count",
			"2"
		);
	});

	it.each([
		["the header 'New room' button", NEW_STORE_RE],
		["the empty-state CTA", "stub-create"],
	])("opens the create sheet from %s", async (_entry, name) => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<RoomsPage />);
		await user.click(screen.getByRole("button", { name }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("mounts the create form only while the sheet is open", () => {
		setMockState({ isCreateOpen: false });
		const { rerender } = render(<RoomsPage />);
		expect(screen.queryByTestId("room-form-stub")).not.toBeInTheDocument();

		setMockState({ isCreateOpen: true });
		rerender(<RoomsPage />);
		expect(screen.getByTestId("room-form-stub")).toBeInTheDocument();
	});

	it("submits the create form through handleCreate", async () => {
		const user = userEvent.setup();
		const state = setMockState({ isCreateOpen: true });
		render(<RoomsPage />);
		await user.click(screen.getByRole("button", { name: "stub-submit" }));
		expect(state.handleCreate).toHaveBeenCalledTimes(1);
		expect(state.handleCreate).toHaveBeenCalledWith({ name: "Akiba" });
	});

	it("disables the Save button while the create mutation is pending", () => {
		setMockState({ isCreateOpen: true, isCreatePending: true });
		render(<RoomsPage />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});

	it("routes RoomList's favorite toggle to handleToggleFavorite with the room id", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<RoomsPage />);
		await user.click(screen.getByRole("button", { name: "stub-toggle-fav" }));
		expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
		expect(state.handleToggleFavorite).toHaveBeenCalledWith("s1");
	});
});
