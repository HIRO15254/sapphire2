import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface FilteredPlayer {
	id: string;
	memo: string | null;
	name: string;
	tags: { color: string; id: string; name: string }[];
}

const mocks = vi.hoisted(() => ({
	search: {
		search: "",
		setSearch: vi.fn(),
		selectedTags: [] as unknown[],
		selectedTagIds: [] as string[],
		addSelectedTag: vi.fn(),
		removeSelectedTag: vi.fn(),
		filteredPlayers: [] as FilteredPlayer[],
	},
	useAddPlayerSearchSpy: vi.fn(),
}));

vi.mock(
	"@/features/live-sessions/components/add-player-sheet/use-add-player-search",
	() => ({
		useAddPlayerSearch: (args: unknown) => {
			mocks.useAddPlayerSearchSpy(args);
			return mocks.search;
		},
	})
);

import { EmptySeatEditor } from "@/features/live-sessions/components/active-session-scene/seat-list/empty-seat-editor";

const REGEX_NINA = /Nina/;
const REGEX_CREATE = /^Create /;
const REGEX_TEMP = /Temp/;

function setup(
	overrides: Partial<React.ComponentProps<typeof EmptySeatEditor>> = {}
) {
	const props: React.ComponentProps<typeof EmptySeatEditor> = {
		excludePlayerIds: ["p-seated"],
		onAddExisting: vi.fn(),
		onAddNew: vi.fn(),
		onAddTemporary: vi.fn(),
		...overrides,
	};
	render(<EmptySeatEditor {...props} />);
	return props;
}

describe("EmptySeatEditor", () => {
	beforeEach(() => {
		mocks.search.search = "";
		mocks.search.filteredPlayers = [];
		mocks.search.setSearch.mockReset();
		mocks.useAddPlayerSearchSpy.mockReset();
	});

	it("passes the excluded (already-seated) ids to the search hook", () => {
		setup({ excludePlayerIds: ["p-seated"] });
		expect(mocks.useAddPlayerSearchSpy).toHaveBeenCalledWith({
			excludePlayerIds: ["p-seated"],
			open: true,
		});
	});

	it("lists available players immediately for one-tap seating", async () => {
		const user = userEvent.setup();
		mocks.search.filteredPlayers = [
			{ id: "p-9", memo: null, name: "Nina", tags: [] },
		];
		const props = setup();
		await user.click(screen.getByRole("button", { name: REGEX_NINA }));
		expect(props.onAddExisting).toHaveBeenCalledTimes(1);
		expect(props.onAddExisting).toHaveBeenCalledWith("p-9", "Nina");
	});

	it("shows the empty-players hint when there is no search and no matches", () => {
		setup();
		expect(screen.getByText("No available players")).toBeInTheDocument();
	});

	it("'Temp' seats a temporary player in one tap", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: REGEX_TEMP }));
		expect(props.onAddTemporary).toHaveBeenCalledTimes(1);
	});

	it("hides the create button when the search is empty", () => {
		setup();
		expect(screen.queryByText(REGEX_CREATE)).not.toBeInTheDocument();
	});

	it("'Create' seats a brand-new player with the trimmed search text", async () => {
		const user = userEvent.setup();
		mocks.search.search = "  Nina  ";
		const props = setup();
		await user.click(screen.getByRole("button", { name: 'Create "Nina"' }));
		expect(props.onAddNew).toHaveBeenCalledTimes(1);
		expect(props.onAddNew).toHaveBeenCalledWith({ name: "Nina" });
	});

	it("typing in the search forwards to the search hook", async () => {
		const user = userEvent.setup();
		setup();
		await user.type(screen.getByLabelText("Search players"), "N");
		expect(mocks.search.setSearch).toHaveBeenCalledWith("N");
	});

	it("renders no tag-filter input (seating stays one purpose)", () => {
		setup();
		expect(screen.queryByText("Tags")).not.toBeInTheDocument();
	});
});
