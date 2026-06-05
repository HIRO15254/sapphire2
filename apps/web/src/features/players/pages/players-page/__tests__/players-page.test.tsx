import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEW_PLAYER_RE = /New player/i;

const hoisted = vi.hoisted(() => ({
	usePlayersPage: vi.fn(),
}));

vi.mock("@/features/players/pages/players-page/use-players-page", () => ({
	usePlayersPage: hoisted.usePlayersPage,
}));

vi.mock("@/features/players/pages/players-page/player-list", () => ({
	PlayerList: ({
		players,
		isLoading,
		isFiltered,
		onCreate,
	}: {
		players: { id: string }[];
		isLoading: boolean;
		isFiltered: boolean;
		onCreate: () => void;
	}) => (
		<div
			data-count={players.length}
			data-filtered={String(isFiltered)}
			data-loading={String(isLoading)}
			data-testid="player-list-stub"
		>
			<button onClick={onCreate} type="button">
				stub-create
			</button>
		</div>
	),
}));

vi.mock("@/features/players/pages/players-page/player-filter", () => ({
	PlayerFilter: ({
		availableTags,
		selectedTagIds,
	}: {
		availableTags: { id: string }[];
		selectedTagIds: string[];
	}) => (
		<div
			data-selected={selectedTagIds.join(",")}
			data-tags={availableTags.length}
			data-testid="player-filter-stub"
		/>
	),
}));

vi.mock("@/features/players/components/player-form", () => ({
	PlayerFormV2: () => <div data-testid="player-form-stub" />,
}));

import { PlayersPage } from "@/features/players/pages/players-page/players-page";

interface MockState {
	availableTags: { color: string; id: string; name: string }[];
	createTag: ReturnType<typeof vi.fn>;
	filterTagIds: string[];
	handleCreate: ReturnType<typeof vi.fn>;
	isCreateOpen: boolean;
	isCreatePending: boolean;
	isLoading: boolean;
	players: { id: string; name: string }[];
	setIsCreateOpen: ReturnType<typeof vi.fn>;
	toggleFilterTag: ReturnType<typeof vi.fn>;
}

function setMockState(overrides: Partial<MockState> = {}): MockState {
	const state: MockState = {
		players: [],
		availableTags: [],
		isLoading: false,
		isCreateOpen: false,
		isCreatePending: false,
		filterTagIds: [],
		setIsCreateOpen: vi.fn(),
		toggleFilterTag: vi.fn(),
		handleCreate: vi.fn(),
		createTag: vi.fn(),
		...overrides,
	};
	hoisted.usePlayersPage.mockReturnValue(state);
	return state;
}

describe("PlayersPage", () => {
	beforeEach(() => {
		hoisted.usePlayersPage.mockReset();
	});

	it("renders the PageHeader with the Players title", () => {
		setMockState();
		render(<PlayersPage />);
		expect(
			screen.getByRole("heading", { name: "Players" })
		).toBeInTheDocument();
	});

	it("forwards isLoading to PlayerList", () => {
		setMockState({ isLoading: true });
		render(<PlayersPage />);
		expect(screen.getByTestId("player-list-stub")).toHaveAttribute(
			"data-loading",
			"true"
		);
	});

	it("forwards the players array to PlayerList", () => {
		setMockState({
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
			],
		});
		render(<PlayersPage />);
		expect(screen.getByTestId("player-list-stub")).toHaveAttribute(
			"data-count",
			"2"
		);
	});

	it("marks PlayerList as filtered when a tag is selected", () => {
		setMockState({ filterTagIds: ["vip"] });
		render(<PlayersPage />);
		expect(screen.getByTestId("player-list-stub")).toHaveAttribute(
			"data-filtered",
			"true"
		);
	});

	it("forwards availableTags and selectedTagIds to PlayerFilter", () => {
		setMockState({
			availableTags: [{ id: "vip", name: "VIP", color: "blue" }],
			filterTagIds: ["vip"],
		});
		render(<PlayersPage />);
		const filter = screen.getByTestId("player-filter-stub");
		expect(filter).toHaveAttribute("data-tags", "1");
		expect(filter).toHaveAttribute("data-selected", "vip");
	});

	it("opens the create sheet when the header 'New player' button is clicked", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<PlayersPage />);
		await user.click(screen.getByRole("button", { name: NEW_PLAYER_RE }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("opens the create sheet when PlayerList's onCreate fires (empty-state CTA)", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<PlayersPage />);
		await user.click(screen.getByRole("button", { name: "stub-create" }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("does not mount the create form body when isCreateOpen is false", () => {
		setMockState({ isCreateOpen: false });
		render(<PlayersPage />);
		expect(screen.queryByTestId("player-form-stub")).not.toBeInTheDocument();
	});

	it("mounts the create form body inside the FormSheet when isCreateOpen is true", () => {
		setMockState({ isCreateOpen: true });
		render(<PlayersPage />);
		expect(screen.getByTestId("player-form-stub")).toBeInTheDocument();
	});

	it("disables the FormSheet Save button while isCreatePending is true", () => {
		setMockState({ isCreateOpen: true, isCreatePending: true });
		render(<PlayersPage />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});
});
