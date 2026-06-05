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

// RoomList owns the loading / empty / data switch (covered by its own test).
// Stub it so the page test focuses on wiring.
vi.mock("@/features/rooms/pages/rooms-page/room-list", () => ({
	RoomList: ({
		rooms,
		isLoading,
		onCreate,
		onToggleFavorite,
	}: {
		rooms: { id: string }[];
		isLoading: boolean;
		onCreate: () => void;
		onToggleFavorite: (id: string) => void;
	}) => (
		<div
			data-count={rooms.length}
			data-loading={String(isLoading)}
			data-testid="room-list-stub"
		>
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
	RoomForm: () => <div data-testid="room-form-stub" />,
}));

import { RoomsPage } from "@/features/rooms/pages/rooms-page/rooms-page";

interface MockState {
	handleCreate: ReturnType<typeof vi.fn>;
	handleToggleFavorite: ReturnType<typeof vi.fn>;
	isCreateOpen: boolean;
	isCreatePending: boolean;
	isLoading: boolean;
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
		isLoading: false,
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

	it("renders the PageHeader with the Rooms title", () => {
		setMockState();
		render(<RoomsPage />);
		expect(screen.getByRole("heading", { name: "Rooms" })).toBeInTheDocument();
	});

	it("forwards isLoading to RoomList", () => {
		setMockState({ isLoading: true });
		render(<RoomsPage />);
		expect(screen.getByTestId("room-list-stub")).toHaveAttribute(
			"data-loading",
			"true"
		);
	});

	it("forwards the rooms array to RoomList", () => {
		setMockState({
			rooms: [
				{ id: "s1", name: "Akiba", ringGameCount: 0, tournamentCount: 0 },
				{ id: "s2", name: "Shinjuku", ringGameCount: 1, tournamentCount: 2 },
			],
		});
		render(<RoomsPage />);
		expect(screen.getByTestId("room-list-stub")).toHaveAttribute(
			"data-count",
			"2"
		);
	});

	it("opens the create sheet when the header 'New room' button is clicked", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<RoomsPage />);
		await user.click(screen.getByRole("button", { name: NEW_STORE_RE }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("opens the create sheet when RoomList's onCreate fires (empty-state CTA)", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<RoomsPage />);
		await user.click(screen.getByRole("button", { name: "stub-create" }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("does not mount the create form body when isCreateOpen is false", () => {
		setMockState({ isCreateOpen: false });
		render(<RoomsPage />);
		expect(screen.queryByTestId("room-form-stub")).not.toBeInTheDocument();
	});

	it("mounts the create form body inside the FormSheet when isCreateOpen is true", () => {
		setMockState({ isCreateOpen: true });
		render(<RoomsPage />);
		expect(screen.getByTestId("room-form-stub")).toBeInTheDocument();
	});

	it("disables the FormSheet Save button while isCreatePending is true", () => {
		setMockState({ isCreateOpen: true, isCreatePending: true });
		render(<RoomsPage />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});

	it("calls handleToggleFavorite when RoomList's onToggleFavorite fires", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<RoomsPage />);
		await user.click(screen.getByRole("button", { name: "stub-toggle-fav" }));
		expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
		expect(state.handleToggleFavorite).toHaveBeenCalledWith("s1");
	});
});
