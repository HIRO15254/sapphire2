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
		onCreate,
	}: {
		players: { id: string; name: string }[];
		onCreate: () => void;
	}) => (
		<div>
			<ul>
				{players.map((player) => (
					<li key={player.id}>{player.name}</li>
				))}
			</ul>
			<button onClick={onCreate} type="button">
				stub-create
			</button>
		</div>
	),
}));

vi.mock("@/features/players/pages/players-page/player-search", () => ({
	PlayerSearch: ({
		onChange,
		value,
	}: {
		onChange: (value: string) => void;
		value: string;
	}) => (
		<input
			aria-label="player-search-stub"
			onChange={(event) => onChange(event.target.value)}
			value={value}
		/>
	),
}));

vi.mock("@/features/players/components/player-form", () => ({
	PlayerForm: () => <div data-testid="player-form-stub" />,
}));

import { PlayersPage } from "@/features/players/pages/players-page/players-page";

interface MockState {
	availableTags: { color: string; id: string; name: string }[];
	createTag: ReturnType<typeof vi.fn>;
	handleCreate: ReturnType<typeof vi.fn>;
	isCreateOpen: boolean;
	isCreatePending: boolean;
	isLoading: boolean;
	isSearching: boolean;
	players: { id: string; name: string }[];
	search: string;
	setIsCreateOpen: ReturnType<typeof vi.fn>;
	setSearch: ReturnType<typeof vi.fn>;
}

function setMockState(overrides: Partial<MockState> = {}): MockState {
	const state: MockState = {
		players: [],
		availableTags: [],
		isLoading: false,
		isCreateOpen: false,
		isCreatePending: false,
		isSearching: false,
		search: "",
		setIsCreateOpen: vi.fn(),
		setSearch: vi.fn(),
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

	it("renders the Players heading", () => {
		setMockState();
		render(<PlayersPage />);
		expect(
			screen.getByRole("heading", { name: "Players" })
		).toBeInTheDocument();
	});

	it("renders one PlayerList row per player", () => {
		setMockState({
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
			],
		});
		render(<PlayersPage />);
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
	});

	it("binds the search box to the current search value", () => {
		setMockState({ search: "vip" });
		render(<PlayersPage />);
		expect(screen.getByLabelText("player-search-stub")).toHaveValue("vip");
	});

	it("routes search box input to setSearch", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<PlayersPage />);
		await user.type(screen.getByLabelText("player-search-stub"), "a");
		expect(state.setSearch).toHaveBeenCalledTimes(1);
		expect(state.setSearch).toHaveBeenCalledWith("a");
	});

	it.each([
		["the header New player button", NEW_PLAYER_RE],
		["PlayerList's empty-state CTA", "stub-create"],
	])("opens the create sheet from %s", async (_, buttonName) => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<PlayersPage />);
		await user.click(screen.getByRole("button", { name: buttonName }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("mounts the create form only while the sheet is open", () => {
		setMockState({ isCreateOpen: false });
		const { rerender } = render(<PlayersPage />);
		expect(screen.queryByTestId("player-form-stub")).not.toBeInTheDocument();
		setMockState({ isCreateOpen: true });
		rerender(<PlayersPage />);
		expect(screen.getByTestId("player-form-stub")).toBeInTheDocument();
	});

	it("disables Save while the create mutation is pending", () => {
		setMockState({ isCreateOpen: true, isCreatePending: true });
		render(<PlayersPage />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});
});
