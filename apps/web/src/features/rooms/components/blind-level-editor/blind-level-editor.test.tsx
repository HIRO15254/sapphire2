import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { MixGroupInfo } from "@/shared/lib/mix-games";
import {
	BlindStructureContent,
	LocalBlindStructureContent,
} from "./blind-level-editor";

const BLIND_HELPER_PATTERN = /drag levels to reorder the structure/i;
const LEVEL_BUTTON_PATTERN = /level/i;

const BIG_BET: MixGroupInfo = {
	id: "g-bigbet",
	label: "Big Bet",
	blind1Label: "SB",
	blind2Label: "BB",
	blind3Label: "Straddle",
	sortIndex: 0,
};

const STUD: MixGroupInfo = {
	id: "g-stud",
	label: "Stud",
	blind1Label: "Small Bet",
	blind2Label: "Big Bet",
	blind3Label: "Bring-in",
	sortIndex: 1,
};

const GROUP_BY_VARIANT: Record<string, MixGroupInfo> = {
	"nl hold'em": BIG_BET,
	razz: STUD,
};

const MIX_LABEL = "8-Game";

const mocks = vi.hoisted(() => ({
	blindLevelsHook: {
		levels: [] as BlindLevelRow[],
		isInitialLoadError: false,
		isLoading: false,
		isAdding: false,
		sensors: [] as never[],
		onRetry: vi.fn(),
		handleDragEnd: vi.fn(),
		handleAddLevel: vi.fn(),
		handleAddBreak: vi.fn(),
		handleDelete: vi.fn(),
		handleUpdate: vi.fn(),
		handleUpdateGameSet: vi.fn(),
		handleCreateLevel: vi.fn(),
	},
	gameGroups: {
		isLoading: false,
		mixDeleted: false,
	},
}));

vi.mock("@/utils/trpc", async () => {
	const { createTrpcMock } = await import("@/__tests__/test-utils");
	const trpc = createTrpcMock();
	return { trpc, trpcClient: trpc };
});

vi.mock("@/features/rooms/hooks/use-blind-levels", () => ({
	useBlindLevels: () => mocks.blindLevelsHook,
}));

vi.mock("@/shared/hooks/use-game-groups", () => ({
	useGameGroups: () => ({
		isLoading: mocks.gameGroups.isLoading,
		groupFor: (label: string) =>
			GROUP_BY_VARIANT[label.trim().toLowerCase()] ?? BIG_BET,
		labelsFor: (label: string) => {
			const group = GROUP_BY_VARIANT[label.trim().toLowerCase()] ?? BIG_BET;
			return {
				blind1: group.blind1Label,
				blind2: group.blind2Label,
				blind3: group.blind3Label,
			};
		},
		isMixValue: (value: string) => {
			const normalized = value.trim().toLowerCase();
			return (
				normalized === "mix" ||
				(!mocks.gameGroups.mixDeleted && normalized === MIX_LABEL.toLowerCase())
			);
		},
		mixCompositionLabels: (label: string) =>
			!mocks.gameGroups.mixDeleted &&
			label.trim().toLowerCase() === MIX_LABEL.toLowerCase()
				? ["NL Hold'em", "Razz"]
				: [],
	}),
}));

vi.mock("@dnd-kit/core", () => ({
	DndContext: ({ children }: { children: ReactNode }) => (
		<div data-testid="dnd-context">{children}</div>
	),
	KeyboardSensor: class {},
	PointerSensor: class {},
	TouchSensor: class {},
	closestCenter: vi.fn(),
	useSensor: vi.fn(),
	useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
	SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
	arrayMove: <T,>(items: T[]) => items,
	sortableKeyboardCoordinates: vi.fn(),
	useSortable: () => ({
		attributes: {},
		isDragging: false,
		listeners: {},
		setNodeRef: vi.fn(),
		transform: null,
		transition: undefined,
	}),
	verticalListSortingStrategy: vi.fn(),
}));

function flatLevel(overrides: Partial<BlindLevelRow> = {}): BlindLevelRow {
	return {
		ante: 25,
		blind1: 100,
		blind2: 200,
		blind3: 50,
		games: null,
		id: "level-1",
		isBreak: false,
		level: 1,
		minutes: 20,
		tournamentId: "tour-1",
		...overrides,
	};
}

function breakLevel(overrides: Partial<BlindLevelRow> = {}): BlindLevelRow {
	return flatLevel({
		ante: null,
		blind1: null,
		blind2: null,
		blind3: null,
		id: "break-2",
		isBreak: true,
		level: 2,
		minutes: 10,
		...overrides,
	});
}

function gameSetLevel(
	sets: Array<{
		blind3?: number | null;
		name?: string | null;
		variants: string[];
	}>,
	overrides: Partial<BlindLevelRow> = {}
): BlindLevelRow {
	return flatLevel({
		ante: null,
		blind1: null,
		blind2: null,
		blind3: null,
		games: sets.map((set, index) => ({
			ante: index === 0 ? 25 : 10,
			blind1: index === 0 ? 400 : 20,
			blind2: index === 0 ? 800 : 40,
			blind3: set.blind3 ?? null,
			name: set.name ?? null,
			variants: set.variants,
		})),
		id: "l1",
		...overrides,
	});
}

const COMPOSITION_SEEDS = [
	{
		name: null,
		variants: ["NL Hold'em"],
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
	},
	{
		name: null,
		variants: ["Razz"],
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
	},
];

const GROUPED_HEADERS = [
	"#",
	"Big Bet",
	"SB",
	"BB",
	"Straddle",
	"Ante",
	"Min",
	"",
	"Stud",
	"Small Bet",
	"Big Bet",
	"Bring-in",
	"Ante",
];

const GENERIC_HYBRID_HEADERS = [
	"#",
	"Game",
	"Blind 1",
	"Blind 2",
	"Blind 3",
	"Ante",
	"Min",
	"",
];

function headerTexts(): (string | null)[] {
	return screen.getAllByRole("columnheader").map((cell) => cell.textContent);
}

function setLevels(levels: BlindLevelRow[]) {
	mocks.blindLevelsHook.levels = levels;
}

describe("BlindStructureContent", () => {
	beforeEach(() => {
		mocks.blindLevelsHook.levels = [];
		mocks.blindLevelsHook.isInitialLoadError = false;
		mocks.blindLevelsHook.isLoading = false;
		mocks.blindLevelsHook.isAdding = false;
		mocks.gameGroups.isLoading = false;
		mocks.gameGroups.mixDeleted = false;
		for (const fn of [
			mocks.blindLevelsHook.onRetry,
			mocks.blindLevelsHook.handleDragEnd,
			mocks.blindLevelsHook.handleAddLevel,
			mocks.blindLevelsHook.handleAddBreak,
			mocks.blindLevelsHook.handleDelete,
			mocks.blindLevelsHook.handleUpdate,
			mocks.blindLevelsHook.handleUpdateGameSet,
			mocks.blindLevelsHook.handleCreateLevel,
		]) {
			fn.mockReset();
		}
	});

	it.each([
		["the levels query", () => (mocks.blindLevelsHook.isLoading = true)],
		["the game masters", () => (mocks.gameGroups.isLoading = true)],
	])("shows the loading state while %s loads", (_source, arrange) => {
		arrange();
		setLevels([flatLevel()]);

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		expect(screen.getByText("Loading levels...")).toBeInTheDocument();
		expect(screen.queryAllByRole("textbox")).toHaveLength(0);
	});

	it("shows a retry error and hides editing controls after the initial list fails", async () => {
		mocks.blindLevelsHook.isInitialLoadError = true;

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load blind levels"
		);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Retry" }));
		expect(mocks.blindLevelsHook.onRetry).toHaveBeenCalledTimes(1);
		expect(
			screen.queryByRole("button", { name: LEVEL_BUTTON_PATTERN })
		).not.toBeInTheDocument();
		expect(screen.queryByText(BLIND_HELPER_PATTERN)).not.toBeInTheDocument();
	});

	it("renders the empty editor with its helper text, header actions, and one new-level row", () => {
		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		expect(screen.getByText(BLIND_HELPER_PATTERN)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Level" })).toBeEnabled();
		expect(screen.getByRole("button", { name: "Break" })).toBeEnabled();
		expect(screen.queryByRole("button", { name: "Delete level" })).toBeNull();
		expect(screen.getAllByRole("textbox")).toHaveLength(5);
		expect(screen.queryByTestId("dnd-context")).not.toBeInTheDocument();
	});

	it("keeps dnd-kit accessibility elements outside the table markup", () => {
		setLevels([flatLevel()]);

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		const dndContext = screen.getByTestId("dnd-context");
		const table = screen.getByRole("table");
		expect(dndContext).toContainElement(table);
		expect(table).not.toContainElement(dndContext);
	});

	it.each([
		["a plain variant", "nlh", null],
		["a mix master variant", MIX_LABEL, COMPOSITION_SEEDS],
	])("routes the header actions to handleAddLevel / handleAddBreak for %s", async (_kind, variant, seeds) => {
		const user = userEvent.setup();

		render(<BlindStructureContent tournamentId="tour-1" variant={variant} />);

		await user.click(screen.getByRole("button", { name: "Level" }));
		expect(mocks.blindLevelsHook.handleAddLevel).toHaveBeenCalledTimes(1);
		expect(mocks.blindLevelsHook.handleAddLevel).toHaveBeenCalledWith(seeds);

		await user.click(screen.getByRole("button", { name: "Break" }));
		expect(mocks.blindLevelsHook.handleAddBreak).toHaveBeenCalledTimes(1);
	});

	it("disables the header actions while a level is being added", () => {
		mocks.blindLevelsHook.isAdding = true;

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		expect(screen.getByRole("button", { name: "Level" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Break" })).toBeDisabled();
	});

	it("routes a row's delete button to handleDelete with the level id", async () => {
		setLevels([flatLevel()]);

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Delete level" }));
		expect(mocks.blindLevelsHook.handleDelete).toHaveBeenCalledTimes(1);
		expect(mocks.blindLevelsHook.handleDelete).toHaveBeenCalledWith("level-1");
	});

	it("routes an inline cell edit to handleUpdate with the level id and patch", () => {
		setLevels([flatLevel(), breakLevel()]);

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		const straddle = screen.getByRole("textbox", { name: "Level 1 Straddle" });
		expect(straddle).toHaveValue("50");
		fireEvent.change(straddle, { target: { value: "75" } });
		fireEvent.blur(straddle);
		const breakMinutes = screen.getByRole("textbox", {
			name: "Break level 2 minutes",
		});
		fireEvent.change(breakMinutes, { target: { value: "" } });
		fireEvent.blur(breakMinutes);

		expect(mocks.blindLevelsHook.handleUpdate).toHaveBeenCalledTimes(2);
		expect(mocks.blindLevelsHook.handleUpdate).toHaveBeenNthCalledWith(
			1,
			"level-1",
			{ blind3: 75 }
		);
		expect(mocks.blindLevelsHook.handleUpdate).toHaveBeenNthCalledWith(
			2,
			"break-2",
			{ minutes: null }
		);
	});

	it("routes a game-set cell edit to handleUpdateGameSet with the level id and cell", () => {
		setLevels([
			gameSetLevel([{ variants: ["NL Hold'em"] }, { variants: ["Razz"] }]),
		]);

		render(<BlindStructureContent tournamentId="tour-1" variant={MIX_LABEL} />);

		const studBlind1 = screen.getByRole("textbox", {
			name: "Level 1 Stud Small Bet",
		});
		expect(studBlind1).toHaveValue("20");
		fireEvent.change(studBlind1, { target: { value: "30" } });
		fireEvent.blur(studBlind1);

		expect(mocks.blindLevelsHook.handleUpdateGameSet).toHaveBeenCalledTimes(1);
		expect(mocks.blindLevelsHook.handleUpdateGameSet).toHaveBeenCalledWith(
			"l1",
			{
				index: 1,
				field: "blind1",
				value: 30,
			}
		);
		expect(mocks.blindLevelsHook.handleUpdate).not.toHaveBeenCalled();
	});

	it("routes the new-level row to handleCreateLevel when it loses focus", () => {
		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		const blind1 = screen.getByRole("textbox", { name: "New level SB" });
		fireEvent.change(blind1, { target: { value: "100" } });
		fireEvent.blur(blind1, { relatedTarget: null });

		expect(mocks.blindLevelsHook.handleCreateLevel).toHaveBeenCalledTimes(1);
		expect(mocks.blindLevelsHook.handleCreateLevel).toHaveBeenCalledWith(
			expect.objectContaining({ blind1: 100 })
		);
	});

	it.each([
		[
			"a plain variant",
			"nlh",
			["#", "SB", "BB", "Straddle", "Ante", "Min", ""],
			5,
		],
		["a mix master variant", MIX_LABEL, GROUPED_HEADERS, 9],
		["the per-level sentinel", "mix", ["#", "Games", "Min", ""], 1],
	])("lays out the header and new-level row for %s", (_kind, variant, headers, newLevelInputs) => {
		render(<BlindStructureContent tournamentId="tour-1" variant={variant} />);

		expect(headerTexts()).toEqual(headers);
		expect(screen.getAllByRole("textbox")).toHaveLength(newLevelInputs);
	});

	it.each([
		[
			"a plain variant",
			"nlh",
			[flatLevel(), breakLevel()],
			[
				"Level 1 SB",
				"Level 1 BB",
				"Level 1 Straddle",
				"Level 1 Ante",
				"Level 1 minutes",
				"Break level 2 minutes",
				"New level SB",
				"New level BB",
				"New level Straddle",
				"New level Ante",
				"New level minutes",
			],
		],
		[
			"a mix master variant",
			MIX_LABEL,
			[
				gameSetLevel([
					{ variants: ["NL Hold'em"], blind3: 50 },
					{ variants: ["Razz"], blind3: 5, name: "Razz rotation" },
				]),
			],
			[
				"Level 1 Big Bet SB",
				"Level 1 Big Bet BB",
				"Level 1 Big Bet Straddle",
				"Level 1 Big Bet Ante",
				"Level 1 minutes",
				"Level 1 Stud Small Bet",
				"Level 1 Stud Big Bet",
				"Level 1 Stud Bring-in",
				"Level 1 Stud Ante",
				"New level Big Bet SB",
				"New level Big Bet BB",
				"New level Big Bet Straddle",
				"New level Big Bet Ante",
				"New level minutes",
				"New level Stud Small Bet",
				"New level Stud Big Bet",
				"New level Stud Bring-in",
				"New level Stud Ante",
			],
		],
	])("names every input by level, group, and field for %s", (_kind, variant, levels, names) => {
		setLevels(levels);

		render(<BlindStructureContent tournamentId="tour-1" variant={variant} />);

		expect(screen.getAllByRole("textbox")).toHaveLength(names.length);
		for (const name of names) {
			expect(screen.getByRole("textbox", { name })).toBeVisible();
		}
		expect(screen.queryByText("Razz rotation")).not.toBeInTheDocument();
	});

	it.each([
		[
			"a level's set order mismatches the composition",
			[gameSetLevel([{ variants: ["Razz"] }, { variants: ["NL Hold'em"] }])],
			GENERIC_HYBRID_HEADERS,
		],
		[
			"a level has fewer sets than the composition",
			[gameSetLevel([{ variants: ["NL Hold'em"] }])],
			GENERIC_HYBRID_HEADERS,
		],
		[
			"only breaks and flat levels are present",
			[
				breakLevel({ id: "break-1", level: 1 }),
				flatLevel({ id: "flat-2", level: 2 }),
			],
			GROUPED_HEADERS,
		],
	])("falls back to the generic header only when %s", (_case, levels, headers) => {
		setLevels(levels);

		render(<BlindStructureContent tournamentId="tour-1" variant={MIX_LABEL} />);

		expect(headerTexts()).toEqual(headers);
	});

	it("LocalBlindStructureContent defers while masters load, then renders orphaned game-set rows", () => {
		mocks.gameGroups.mixDeleted = true;
		mocks.gameGroups.isLoading = true;
		const level = gameSetLevel([
			{ variants: ["Limit Hold'em"], name: "Limit games" },
		]);
		const onChange = vi.fn();

		const { rerender } = render(
			<LocalBlindStructureContent
				onChange={onChange}
				value={[level]}
				variant={MIX_LABEL}
			/>
		);
		expect(screen.getByText("Loading levels...")).toBeInTheDocument();
		expect(screen.queryAllByRole("textbox")).toHaveLength(0);

		mocks.gameGroups.isLoading = false;
		rerender(
			<LocalBlindStructureContent
				onChange={onChange}
				value={[level]}
				variant={MIX_LABEL}
			/>
		);
		expect(headerTexts()).toEqual(GENERIC_HYBRID_HEADERS);
		expect(screen.getByDisplayValue("400")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Delete level" }));
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith([]);
	});
});
