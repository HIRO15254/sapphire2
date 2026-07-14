import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	BlindStructureContent,
	LocalBlindStructureContent,
} from "./blind-level-editor";
import { EmptyRow } from "./empty-row/empty-row";

const ADD_LEVEL_PATTERN = /add level/i;
const BLIND_HELPER_PATTERN = /drag levels to reorder the structure/i;
const BREAK_BUTTON_PATTERN = /break/i;
const LEVEL_BUTTON_PATTERN = /level/i;
const STRADDLE_PATTERN = /Straddle/;

const mocks = vi.hoisted(() => ({
	blindLevels: [] as Array<{
		ante: number | null;
		blind1: number | null;
		blind2: number | null;
		blind3: number | null;
		games?: Array<{
			ante: number | null;
			blind1: number | null;
			blind2: number | null;
			blind3: number | null;
			name: string | null;
			variants: string[];
		}> | null;
		id: string;
		isBreak: boolean;
		level: number;
		minutes: number | null;
		tournamentId: string;
	}>,
	createMutate: vi.fn(),
	gameGroups: [] as Array<{
		blind1Label: string | null;
		blind2Label: string | null;
		blind3Label: string | null;
		builtinKey: string | null;
		id: string;
		label: string;
	}>,
	gameVariants: [] as Array<{
		builtinKey: string | null;
		groupId: string;
		id: string;
		label: string;
		shortLabel: string | null;
		sortOrder: number;
	}>,
	gameMixes: [] as Array<{
		builtinKey: string | null;
		games: string[];
		id: string;
		label: string;
	}>,
	deleteMutate: vi.fn(),
	invalidateQueries: vi.fn(),
	isLoading: false,
	mastersLoading: false,
	reorderMutate: vi.fn(),
	setQueryData: vi.fn(),
	updateMutate: vi.fn(),
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

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: { mutationFn: (arg: unknown) => unknown }) => ({
		isPending: false,
		mutate: (arg: unknown) => {
			// Mirror the update mutation's onMutate resolution so the synchronous
			// transport mock receives the same resolved games payload as production.
			if (
				typeof arg === "object" &&
				arg !== null &&
				"cell" in arg &&
				"id" in arg
			) {
				const variables = arg as {
					cell: {
						field: "ante" | "blind1" | "blind2" | "blind3";
						index: number;
						value: number | null;
					};
					id: string;
				};
				const row = mocks.blindLevels.find(
					(level) => level.id === variables.id
				);
				const games = row?.games?.map((game, index) =>
					index === variables.cell.index
						? { ...game, [variables.cell.field]: variables.cell.value }
						: game
				);
				options.mutationFn({
					...variables,
					resolvedUpdates: games ? { games } : null,
				});
				return;
			}
			options.mutationFn(arg);
		},
	}),
	// useGameGroups also calls useQuery (for trpc.gameVariant.list,
	// trpc.gameGroup.list, and trpc.gameMix.list) — branch on the queryKey so
	// it doesn't collide with the blind-levels query below.
	useQuery: (options: { queryKey?: readonly unknown[] }) => {
		if (options?.queryKey?.[0] === "gameMix") {
			return { data: mocks.gameMixes, isLoading: mocks.mastersLoading };
		}
		if (options?.queryKey?.[0] === "gameVariant") {
			return { data: mocks.gameVariants, isLoading: mocks.mastersLoading };
		}
		if (options?.queryKey?.[0] === "gameGroup") {
			return { data: mocks.gameGroups, isLoading: mocks.mastersLoading };
		}
		return {
			data: mocks.blindLevels,
			isLoading: mocks.isLoading,
		};
	},
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		// handleUpdateGameSet derives the games payload from the freshest
		// cache value; serve the same levels the query mock renders from.
		getQueryData: () => mocks.blindLevels,
		invalidateQueries: mocks.invalidateQueries,
		setQueryData: mocks.setQueryData,
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		blindLevel: {
			listByTournament: {
				queryOptions: ({ tournamentId }: { tournamentId: string }) => ({
					queryKey: ["blindLevel.listByTournament", tournamentId],
				}),
			},
		},
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: async () => [],
				}),
			},
		},
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: async () => [],
				}),
			},
		},
		gameMix: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameMix", "list"],
					queryFn: async () => [],
				}),
			},
		},
	},
	trpcClient: {
		blindLevel: {
			create: {
				mutate: (input: unknown) => mocks.createMutate(input),
			},
			delete: {
				mutate: (input: unknown) => mocks.deleteMutate(input),
			},
			reorder: {
				mutate: (input: unknown) => mocks.reorderMutate(input),
			},
			update: {
				mutate: (input: unknown) => mocks.updateMutate(input),
			},
		},
	},
}));

// 8-Game mix master resolving to NL Hold'em (Big Bet) + Razz (Stud).
function seedMixMasterData() {
	mocks.gameGroups = [
		{
			id: "g-bigbet",
			builtinKey: "bigbet",
			label: "Big Bet",
			blind1Label: "SB",
			blind2Label: "BB",
			blind3Label: "Straddle",
		},
		{
			id: "g-stud",
			builtinKey: "stud",
			label: "Stud",
			blind1Label: "Small Bet",
			blind2Label: "Big Bet",
			blind3Label: "Bring-in",
		},
	];
	mocks.gameVariants = [
		{
			id: "v-nlh",
			builtinKey: "nlh",
			label: "NL Hold'em",
			shortLabel: "NLH",
			groupId: "g-bigbet",
			sortOrder: 0,
		},
		{
			id: "v-razz",
			builtinKey: "razz",
			label: "Razz",
			shortLabel: "Razz",
			groupId: "g-stud",
			sortOrder: 1,
		},
	];
	mocks.gameMixes = [
		{
			id: "m-8game",
			builtinKey: "8-game",
			label: "8-Game",
			games: ["v-nlh", "v-razz"],
		},
	];
}

function seedPlainVariantData(blind3Label: string | null) {
	mocks.gameGroups = [
		{
			id: "g-bigbet",
			builtinKey: "bigbet",
			label: "Big Bet",
			blind1Label: "SB",
			blind2Label: "BB",
			blind3Label,
		},
	];
	mocks.gameVariants = [
		{
			id: "v-nlh",
			builtinKey: "nlh",
			label: "NL Hold'em",
			shortLabel: "NLH",
			groupId: "g-bigbet",
			sortOrder: 0,
		},
	];
}

describe("BlindStructureContent", () => {
	beforeEach(() => {
		mocks.blindLevels = [];
		mocks.gameGroups = [];
		mocks.gameVariants = [];
		mocks.gameMixes = [];
		mocks.isLoading = false;
		mocks.mastersLoading = false;
		mocks.createMutate.mockReset();
		mocks.deleteMutate.mockReset();
		mocks.reorderMutate.mockReset();
		mocks.updateMutate.mockReset();
		// The production update mutation chains `.then` on the transport result.
		// Keep this mock promise-shaped so the mutation's rejected/settled paths
		// remain realistic without creating unhandled rejections in the component
		// tests that exercise blur-driven updates.
		mocks.updateMutate.mockResolvedValue(null);
		mocks.invalidateQueries.mockReset();
		mocks.setQueryData.mockReset();
	});

	it("renders the reorder helper text", () => {
		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		expect(screen.getByText(BLIND_HELPER_PATTERN)).toBeInTheDocument();
	});

	it("shows the loading state", () => {
		mocks.isLoading = true;

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		expect(screen.getByText("Loading levels...")).toBeInTheDocument();
	});

	it("adds a level and a break from the header actions", async () => {
		const user = userEvent.setup();

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		await user.click(
			screen.getByRole("button", { name: LEVEL_BUTTON_PATTERN })
		);
		await user.click(
			screen.getByRole("button", { name: BREAK_BUTTON_PATTERN })
		);

		expect(mocks.createMutate).toHaveBeenCalledWith({
			isBreak: false,
			level: 1,
			tournamentId: "tour-1",
		});
		expect(mocks.createMutate).toHaveBeenCalledWith({
			isBreak: true,
			level: 1,
			tournamentId: "tour-1",
		});
	});

	it("creates a new level row with autofill when the new row loses focus", () => {
		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		const numberInputs = screen.getAllByRole("textbox");
		const smallBlindInput = numberInputs[0];
		fireEvent.change(smallBlindInput, { target: { value: "100" } });
		fireEvent.blur(smallBlindInput, { relatedTarget: null });

		expect(mocks.createMutate).toHaveBeenCalledWith({
			ante: 200,
			blind1: 100,
			blind2: 200,
			isBreak: false,
			level: 1,
			tournamentId: "tour-1",
		});
	});

	it("renders the editor table when there are no levels", () => {
		mocks.blindLevels = [];

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		// Loading text is absent because isLoading=false; the helper text and the
		// empty new-row table are present.
		expect(screen.getByText(BLIND_HELPER_PATTERN)).toBeInTheDocument();
		expect(screen.queryByText("Loading levels...")).not.toBeInTheDocument();
	});

	it("keeps dnd-kit accessibility elements outside the table markup", () => {
		mocks.blindLevels = [
			{
				ante: 200,
				blind1: 100,
				blind2: 200,
				blind3: null,
				id: "level-1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		const dndContext = screen.getByTestId("dnd-context");
		const table = screen.getByRole("table");
		expect(dndContext).toContainElement(table);
		expect(table).not.toContainElement(dndContext);
	});

	it("deletes an existing level", async () => {
		const user = userEvent.setup();
		mocks.blindLevels = [
			{
				ante: 200,
				blind1: 100,
				blind2: 200,
				blind3: null,
				id: "level-1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		await user.click(screen.getByRole("button", { name: "Delete level" }));

		expect(mocks.deleteMutate).toHaveBeenCalledWith({ id: "level-1" });
	});

	it("renders numeric cells as text inputs with a numeric input mode", () => {
		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		const inputs = screen.getAllByRole("textbox");
		expect(inputs.length).toBeGreaterThan(0);
		for (const input of inputs) {
			expect(input).toHaveAttribute("type", "text");
			expect(input).toHaveAttribute("inputmode", "numeric");
		}
	});

	it("updates a break's minutes from typed digits and maps empty text to null", () => {
		mocks.blindLevels = [
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				id: "break-1",
				isBreak: true,
				level: 1,
				minutes: 10,
				tournamentId: "tour-1",
			},
		];

		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);

		// First textbox is the break row's minutes cell (empty new-level row follows).
		const minutesInput = screen.getAllByRole("textbox")[0];
		fireEvent.change(minutesInput, { target: { value: "15" } });
		fireEvent.blur(minutesInput);
		expect(mocks.updateMutate).toHaveBeenCalledTimes(1);
		expect(mocks.updateMutate).toHaveBeenCalledWith({
			id: "break-1",
			minutes: 15,
		});

		fireEvent.change(minutesInput, { target: { value: "" } });
		fireEvent.blur(minutesInput);
		expect(mocks.updateMutate).toHaveBeenCalledTimes(2);
		expect(mocks.updateMutate).toHaveBeenLastCalledWith({
			id: "break-1",
			minutes: null,
		});
	});

	it("renders and updates a plain variant's named third blind with aligned rows", () => {
		seedPlainVariantData("Straddle");
		mocks.blindLevels = [
			{
				ante: 25,
				blind1: 100,
				blind2: 200,
				blind3: 50,
				id: "level-1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				id: "break-2",
				isBreak: true,
				level: 2,
				minutes: 10,
				tournamentId: "tour-1",
			},
		];

		render(
			<BlindStructureContent tournamentId="tour-1" variant="NL Hold'em" />
		);

		expect(
			screen.getByRole("columnheader", { name: "Straddle" })
		).toBeVisible();
		const thirdBlind = screen.getByRole("textbox", {
			name: "Level 1 Straddle",
		});
		expect(thirdBlind).toHaveValue("50");
		fireEvent.change(thirdBlind, { target: { value: "75" } });
		fireEvent.blur(thirdBlind);
		expect(mocks.updateMutate).toHaveBeenCalledTimes(1);
		expect(mocks.updateMutate).toHaveBeenNthCalledWith(1, {
			id: "level-1",
			blind3: 75,
		});

		const headerRow = screen
			.getByRole("columnheader", { name: "#" })
			.closest("tr");
		expect(
			within(headerRow as HTMLTableRowElement).getAllByRole("columnheader")
		).toHaveLength(7);
		const levelRow = thirdBlind.closest("tr");
		expect(
			within(levelRow as HTMLTableRowElement).getAllByRole("cell")
		).toHaveLength(7);
		const breakRow = screen
			.getByRole("textbox", { name: "Break level 2 minutes" })
			.closest("tr");
		const breakCells = within(breakRow as HTMLTableRowElement).getAllByRole(
			"cell"
		);
		expect(breakCells).toHaveLength(4);
		expect(breakCells[1]).toHaveAttribute("colspan", "4");
		const emptyRow = screen.getByText("+").closest("tr");
		expect(
			within(emptyRow as HTMLTableRowElement).getAllByRole("cell")
		).toHaveLength(7);
	});

	it("creates a plain variant level with its named third blind", () => {
		seedPlainVariantData("Straddle");
		render(
			<BlindStructureContent tournamentId="tour-1" variant="NL Hold'em" />
		);

		const blind1 = screen.getByRole("textbox", { name: "New level SB" });
		const blind3 = screen.getByRole("textbox", {
			name: "New level Straddle",
		});
		fireEvent.change(blind1, { target: { value: "100" } });
		fireEvent.blur(blind1, { relatedTarget: blind3 });
		fireEvent.change(blind3, { target: { value: "50" } });
		fireEvent.blur(blind3, { relatedTarget: null });

		expect(mocks.createMutate).toHaveBeenCalledTimes(1);
		expect(mocks.createMutate).toHaveBeenNthCalledWith(1, {
			tournamentId: "tour-1",
			level: 1,
			isBreak: false,
			blind1: 100,
			blind2: 200,
			blind3: 50,
			ante: 200,
		});
	});

	it("omits the third-blind column for a plain variant whose label is null", () => {
		seedPlainVariantData(null);
		mocks.blindLevels = [
			{
				ante: 25,
				blind1: 100,
				blind2: 200,
				blind3: 50,
				id: "level-1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				id: "break-2",
				isBreak: true,
				level: 2,
				minutes: 10,
				tournamentId: "tour-1",
			},
		];

		render(
			<BlindStructureContent tournamentId="tour-1" variant="NL Hold'em" />
		);

		expect(screen.queryByRole("columnheader", { name: "Straddle" })).toBeNull();
		expect(
			screen.queryByRole("textbox", { name: STRADDLE_PATTERN })
		).toBeNull();
		const headerRow = screen
			.getByRole("columnheader", { name: "#" })
			.closest("tr");
		expect(
			within(headerRow as HTMLTableRowElement).getAllByRole("columnheader")
		).toHaveLength(6);
		const levelRow = screen
			.getByRole("textbox", { name: "Level 1 SB" })
			.closest("tr");
		expect(
			within(levelRow as HTMLTableRowElement).getAllByRole("cell")
		).toHaveLength(6);
		const breakRow = screen
			.getByRole("textbox", { name: "Break level 2 minutes" })
			.closest("tr");
		const breakCells = within(breakRow as HTMLTableRowElement).getAllByRole(
			"cell"
		);
		expect(breakCells[1]).toHaveAttribute("colspan", "3");
		const emptyRow = screen.getByText("+").closest("tr");
		expect(
			within(emptyRow as HTMLTableRowElement).getAllByRole("cell")
		).toHaveLength(6);
	});

	it("gives every flat and break input a contextual accessible name", () => {
		seedPlainVariantData("Straddle");
		mocks.blindLevels = [
			{
				ante: 25,
				blind1: 100,
				blind2: 200,
				blind3: 50,
				id: "level-1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				id: "break-2",
				isBreak: true,
				level: 2,
				minutes: 10,
				tournamentId: "tour-1",
			},
		];

		render(
			<BlindStructureContent tournamentId="tour-1" variant="NL Hold'em" />
		);

		for (const input of screen.getAllByRole("textbox")) {
			expect(input).toHaveAccessibleName();
		}
		for (const name of [
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
		]) {
			expect(screen.getByRole("textbox", { name })).toBeVisible();
		}
	});

	it("keeps flat blind headers for a mix master variant (games rotate independently of levels)", () => {
		mocks.gameMixes = [
			{ id: "m-8game", builtinKey: "8-game", label: "8-Game", games: [] },
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
		expect(screen.queryByText("Games")).not.toBeInTheDocument();
		expect(screen.getByText("Blind 1")).toBeInTheDocument();
		expect(screen.getByText("Blind 2")).toBeInTheDocument();
	});

	it("shows the per-level games column only for the per-level sentinel variant", () => {
		render(<BlindStructureContent tournamentId="tour-1" variant="mix" />);
		expect(screen.getByText("Games")).toBeInTheDocument();
	});

	it("labels each game-set row with its owning group's name (matching the header), not the set composition/custom name", () => {
		seedMixMasterData();
		mocks.blindLevels = [
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				games: [
					{
						ante: null,
						blind1: 400,
						blind2: 800,
						blind3: null,
						// A stored custom name (as a single-variant level would carry)
						// must NOT surface in the editor — the group name wins.
						name: "Razz rotation",
						variants: ["Razz"],
					},
					{
						ante: 25,
						blind1: 100,
						blind2: 200,
						blind3: null,
						name: null,
						variants: ["NL Hold'em"],
					},
				],
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
		expect(screen.getByText("Game")).toBeInTheDocument();
		// Group names, not the composition ("Razz"/"NL Hold'em") or custom name.
		// "Big Bet" and "Stud" appear in both header and row cells.
		expect(screen.getAllByText("Big Bet").length).toBeGreaterThanOrEqual(2);
		expect(screen.getAllByText("Stud").length).toBeGreaterThanOrEqual(2);
		expect(screen.queryByText("Razz rotation")).not.toBeInTheDocument();
		expect(screen.getByDisplayValue("400")).toBeInTheDocument();
		expect(screen.getByDisplayValue("100")).toBeInTheDocument();
	});

	it("edits a set's amount inline and patches only that set", () => {
		mocks.gameMixes = [
			{ id: "m-8game", builtinKey: "8-game", label: "8-Game", games: [] },
		];
		mocks.blindLevels = [
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				games: [
					{
						ante: null,
						blind1: 400,
						blind2: 800,
						blind3: null,
						name: "Limit games",
						variants: ["Limit Hold'em"],
					},
					{
						ante: 25,
						blind1: 100,
						blind2: 200,
						blind3: null,
						name: null,
						variants: ["NL Hold'em"],
					},
				],
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
		const blind1Input = screen.getByDisplayValue("400");
		fireEvent.change(blind1Input, { target: { value: "500" } });
		fireEvent.blur(blind1Input);
		expect(mocks.updateMutate).toHaveBeenCalledTimes(1);
		expect(mocks.updateMutate).toHaveBeenNthCalledWith(1, {
			id: "l1",
			games: [
				{
					ante: null,
					blind1: 500,
					blind2: 800,
					blind3: null,
					name: "Limit games",
					variants: ["Limit Hold'em"],
				},
				{
					ante: 25,
					blind1: 100,
					blind2: 200,
					blind3: null,
					name: null,
					variants: ["NL Hold'em"],
				},
			],
		});
	});

	it("has no flat/game-sets toggle on a game-set level", () => {
		mocks.gameMixes = [
			{ id: "m-8game", builtinKey: "8-game", label: "8-Game", games: [] },
		];
		mocks.blindLevels = [
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				games: [
					{
						ante: null,
						blind1: 400,
						blind2: 800,
						blind3: null,
						name: "Limit games",
						variants: ["Limit Hold'em"],
					},
				],
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
		expect(
			screen.queryByRole("button", { name: "Use single blind set" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Use game sets" })
		).not.toBeInTheDocument();
	});

	it("renders one header row per game group for a mix master variant", () => {
		seedMixMasterData();
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
		const headers = screen
			.getAllByRole("columnheader")
			.map((cell) => cell.textContent);
		expect(headers).toEqual([
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
		]);
	});

	it("edits each named mix third blind slot under its owning group", () => {
		seedMixMasterData();
		mocks.blindLevels = [
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				games: [
					{
						ante: 25,
						blind1: 100,
						blind2: 200,
						blind3: 50,
						name: null,
						variants: ["NL Hold'em"],
					},
					{
						ante: 10,
						blind1: 20,
						blind2: 40,
						blind3: 5,
						name: null,
						variants: ["Razz"],
					},
				],
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);

		expect(screen.getByText("Straddle")).toBeInTheDocument();
		expect(screen.getByText("Bring-in")).toBeInTheDocument();
		const straddle = screen.getByDisplayValue("50");
		const bringIn = screen.getByDisplayValue("5");
		fireEvent.change(straddle, { target: { value: "75" } });
		fireEvent.blur(straddle);

		expect(bringIn).toBeInTheDocument();
		expect(mocks.updateMutate).toHaveBeenNthCalledWith(1, {
			id: "l1",
			games: [
				{
					ante: 25,
					blind1: 100,
					blind2: 200,
					blind3: 75,
					name: null,
					variants: ["NL Hold'em"],
				},
				{
					ante: 10,
					blind1: 20,
					blind2: 40,
					blind3: 5,
					name: null,
					variants: ["Razz"],
				},
			],
		});
	});

	it("gives every hybrid game-set input a level, game, and field accessible name", () => {
		seedMixMasterData();
		mocks.blindLevels = [
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				games: [
					{
						ante: 25,
						blind1: 100,
						blind2: 200,
						blind3: 50,
						name: null,
						variants: ["NL Hold'em"],
					},
					{
						ante: 10,
						blind1: 20,
						blind2: 40,
						blind3: 5,
						name: null,
						variants: ["Razz"],
					},
				],
				id: "level-1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];

		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);

		for (const input of screen.getAllByRole("textbox")) {
			expect(input).toHaveAccessibleName();
		}
		for (const name of [
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
		]) {
			expect(screen.getByRole("textbox", { name })).toBeVisible();
		}
	});

	it("does not show a third blind input for a group without a third blind label", () => {
		seedMixMasterData();
		mocks.gameGroups[1].blind3Label = null;
		mocks.blindLevels = [
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				games: [
					{
						ante: 25,
						blind1: 100,
						blind2: 200,
						blind3: 50,
						name: null,
						variants: ["NL Hold'em"],
					},
					{
						ante: 10,
						blind1: 20,
						blind2: 40,
						blind3: 5,
						name: null,
						variants: ["Razz"],
					},
				],
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);

		expect(screen.getByText("Straddle")).toBeInTheDocument();
		expect(screen.queryByText("Bring-in")).not.toBeInTheDocument();
		expect(screen.getByDisplayValue("50")).toBeInTheDocument();
		expect(screen.queryByDisplayValue("5")).not.toBeInTheDocument();
	});

	it("keeps legacy flat level values under blind1, blind2, empty blind3, then ante", () => {
		seedMixMasterData();
		mocks.blindLevels = [
			{
				ante: 25,
				blind1: 100,
				blind2: 200,
				blind3: null,
				id: "flat-1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);

		const row = screen.getByDisplayValue("100").closest("tr");
		expect(row).not.toBeNull();
		const cells = within(row as HTMLTableRowElement).getAllByRole("cell");
		expect(
			within(cells[2] as HTMLElement).getByDisplayValue("100")
		).toBeVisible();
		expect(
			within(cells[3] as HTMLElement).getByDisplayValue("200")
		).toBeVisible();
		expect(within(cells[4] as HTMLElement).queryByRole("textbox")).toBeNull();
		expect(
			within(cells[5] as HTMLElement).getByDisplayValue("25")
		).toBeVisible();
	});

	it("keeps the hybrid empty row's third-blind spacer after blind2", () => {
		render(
			<table>
				<tbody>
					<EmptyRow gameColumn hasBlind3Column onCreateLevel={vi.fn()} />
				</tbody>
			</table>
		);

		const row = screen.getByText("+").closest("tr");
		expect(row).not.toBeNull();
		const cells = within(row as HTMLTableRowElement).getAllByRole("cell");
		expect(within(cells[2] as HTMLElement).getByRole("textbox")).toBeVisible();
		expect(within(cells[3] as HTMLElement).getByRole("textbox")).toBeVisible();
		expect(within(cells[4] as HTMLElement).queryByRole("textbox")).toBeNull();
		expect(within(cells[5] as HTMLElement).getByRole("textbox")).toBeVisible();
	});

	it("creates a game-set level from the multi-row empty block", () => {
		seedMixMasterData();
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);

		// Empty-block DOM order: set0 b1/b2/b3/ante, minutes (row-spanned into
		// the first row), then set1 b1/b2/b3/ante.
		const [set0Blind1, set0Blind2, set0Blind3] = screen.getAllByRole("textbox");
		fireEvent.change(set0Blind1, { target: { value: "100" } });
		fireEvent.blur(set0Blind1, { relatedTarget: set0Blind2 });
		fireEvent.change(set0Blind3, { target: { value: "50" } });
		fireEvent.blur(set0Blind3, { relatedTarget: null });

		expect(mocks.createMutate).toHaveBeenCalledTimes(1);
		expect(mocks.createMutate).toHaveBeenNthCalledWith(1, {
			tournamentId: "tour-1",
			level: 1,
			isBreak: false,
			// Seeded buckets store no display name (null); labels derive from
			// the group at render time (mix-games c18 contract).
			games: [
				{
					name: null,
					variants: ["NL Hold'em"],
					blind1: 100,
					blind2: 200,
					blind3: 50,
					ante: 200,
				},
				{
					name: null,
					variants: ["Razz"],
					blind1: null,
					blind2: null,
					blind3: null,
					ante: null,
				},
			],
		});
	});

	it("keeps the flat empty row for a mix master with an empty composition", () => {
		mocks.gameMixes = [
			{ id: "m-8game", builtinKey: "8-game", label: "8-Game", games: [] },
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);

		const numberInputs = screen.getAllByRole("textbox");
		const smallBlindInput = numberInputs[0];
		fireEvent.change(smallBlindInput, { target: { value: "100" } });
		fireEvent.blur(smallBlindInput, { relatedTarget: null });

		expect(mocks.createMutate).toHaveBeenCalledTimes(1);
		expect(mocks.createMutate.mock.calls[0][0].games).toBeUndefined();
	});

	it("seeds a new level with the mix composition's game sets for a mix master variant", async () => {
		const user = userEvent.setup();
		seedMixMasterData();
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
		await user.click(screen.getByRole("button", { name: "Level" }));
		expect(mocks.createMutate).toHaveBeenCalledTimes(1);
		expect(mocks.createMutate).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				games: [
					expect.objectContaining({ variants: ["NL Hold'em"] }),
					expect.objectContaining({ variants: ["Razz"] }),
				],
			})
		);
	});

	it("does not seed game sets for a plain variant's new level", async () => {
		const user = userEvent.setup();
		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);
		await user.click(screen.getByRole("button", { name: "Level" }));
		expect(mocks.createMutate).toHaveBeenCalledTimes(1);
		expect(mocks.createMutate.mock.calls[0][0].games).toBeUndefined();
	});

	describe("orphaned / loading mix master (hybrid fallback)", () => {
		const GAME_SET_LEVEL = {
			ante: null,
			blind1: null,
			blind2: null,
			blind3: null,
			games: [
				{
					ante: null,
					blind1: 400,
					blind2: 800,
					blind3: null,
					name: "Limit games",
					variants: ["Limit Hold'em"],
				},
			],
			id: "l1",
			isBreak: false,
			level: 1,
			minutes: 20,
			tournamentId: "tour-1",
		};

		it("still renders game-set rows when the mix master was deleted (gameMix.list empty)", () => {
			mocks.gameMixes = [];
			mocks.blindLevels = [GAME_SET_LEVEL];
			render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
			// The level keeps its per-set rendering with the generic hybrid header.
			expect(screen.getByText("Game")).toBeInTheDocument();
			expect(screen.getByText("Limit games")).toBeInTheDocument();
			expect(screen.getByDisplayValue("400")).toBeInTheDocument();
		});

		it("shows the loading state while game masters load instead of the flat table", () => {
			mocks.mastersLoading = true;
			mocks.blindLevels = [GAME_SET_LEVEL];
			render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
			expect(screen.getByText("Loading levels...")).toBeInTheDocument();
			expect(screen.queryAllByRole("textbox")).toHaveLength(0);
		});

		it("LocalBlindStructureContent renders game-set rows for orphaned mix levels", () => {
			mocks.gameMixes = [];
			render(
				<LocalBlindStructureContent
					onChange={vi.fn()}
					value={[GAME_SET_LEVEL as unknown as BlindLevelRow]}
					variant="8-Game"
				/>
			);
			expect(screen.getByText("Game")).toBeInTheDocument();
			expect(screen.getByText("Limit games")).toBeInTheDocument();
			expect(screen.getByDisplayValue("400")).toBeInTheDocument();
		});

		it("LocalBlindStructureContent defers the table while game masters load", () => {
			mocks.mastersLoading = true;
			render(
				<LocalBlindStructureContent
					onChange={vi.fn()}
					value={[GAME_SET_LEVEL as unknown as BlindLevelRow]}
					variant="8-Game"
				/>
			);
			expect(screen.getByText("Loading levels...")).toBeInTheDocument();
			expect(screen.queryAllByRole("textbox")).toHaveLength(0);
		});
	});

	describe("grouped header vs stored rows (composition mismatch)", () => {
		function gameSetLevel(
			variantsInOrder: string[][]
		): (typeof mocks.blindLevels)[number] {
			return {
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				games: variantsInOrder.map((variants) => ({
					ante: null,
					blind1: 100,
					blind2: 200,
					blind3: null,
					name: null,
					variants,
				})),
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			};
		}

		it("keeps the grouped header when every game-set level matches the composition order", () => {
			seedMixMasterData();
			mocks.blindLevels = [gameSetLevel([["NL Hold'em"], ["Razz"]])];
			render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
			const headers = screen
				.getAllByRole("columnheader")
				.map((cell) => cell.textContent);
			expect(headers).toEqual([
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
			]);
		});

		it("falls back to the generic header when a level's set order mismatches the composition", () => {
			seedMixMasterData();
			const mismatchedLevel = gameSetLevel([["Razz"], ["NL Hold'em"]]);
			const firstGame = mismatchedLevel.games?.[0];
			expect(firstGame).toBeDefined();
			if (!firstGame) {
				return;
			}
			firstGame.blind3 = 5;
			mocks.blindLevels = [mismatchedLevel];
			render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
			const headers = screen
				.getAllByRole("columnheader")
				.map((cell) => cell.textContent);
			expect(headers).toEqual([
				"#",
				"Game",
				"Blind 1",
				"Blind 2",
				"Blind 3",
				"Ante",
				"Min",
				"",
			]);
			expect(screen.queryByText("Small Bet")).not.toBeInTheDocument();
			expect(screen.getByDisplayValue("5")).toBeInTheDocument();
		});

		it("falls back to the generic header when a level has fewer sets than the composition", () => {
			seedMixMasterData();
			mocks.blindLevels = [gameSetLevel([["NL Hold'em"]])];
			render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
			const headers = screen
				.getAllByRole("columnheader")
				.map((cell) => cell.textContent);
			expect(headers).toEqual([
				"#",
				"Game",
				"Blind 1",
				"Blind 2",
				"Blind 3",
				"Ante",
				"Min",
				"",
			]);
		});

		it("ignores breaks and flat levels when checking the composition match", () => {
			seedMixMasterData();
			mocks.blindLevels = [
				{
					ante: null,
					blind1: null,
					blind2: null,
					blind3: null,
					id: "break-1",
					isBreak: true,
					level: 1,
					minutes: 10,
					tournamentId: "tour-1",
				},
				{
					ante: 25,
					blind1: 100,
					blind2: 200,
					blind3: null,
					id: "flat-1",
					isBreak: false,
					level: 2,
					minutes: 20,
					tournamentId: "tour-1",
				},
			];
			render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
			expect(screen.getByText("Small Bet")).toBeInTheDocument();
		});
	});

	describe("per-level ('mix') empty row", () => {
		it("renders no flat blind inputs — only the minutes cell and an add affordance", () => {
			render(<BlindStructureContent tournamentId="tour-1" variant="mix" />);
			expect(screen.getAllByRole("textbox")).toHaveLength(1);
			expect(
				screen.getByRole("textbox", { name: "New level minutes" })
			).toBeVisible();
			expect(
				screen.getByRole("button", { name: ADD_LEVEL_PATTERN })
			).toBeInTheDocument();
		});

		it("labels an existing per-level games row's minutes with its level", () => {
			mocks.blindLevels = [
				{
					ante: null,
					blind1: null,
					blind2: null,
					blind3: null,
					games: null,
					id: "level-1",
					isBreak: false,
					level: 1,
					minutes: 20,
					tournamentId: "tour-1",
				},
			];

			render(<BlindStructureContent tournamentId="tour-1" variant="mix" />);

			expect(
				screen.getByRole("textbox", { name: "Level 1 minutes" })
			).toHaveValue("20");
			expect(
				screen.getByRole("textbox", { name: "New level minutes" })
			).toBeVisible();
		});

		it("creates a level with typed minutes from the add affordance", async () => {
			const user = userEvent.setup();
			render(<BlindStructureContent tournamentId="tour-1" variant="mix" />);
			const minutesInput = screen.getAllByRole("textbox")[0];
			fireEvent.change(minutesInput, { target: { value: "30" } });
			await user.click(screen.getByRole("button", { name: ADD_LEVEL_PATTERN }));
			expect(mocks.createMutate).toHaveBeenCalledTimes(1);
			expect(mocks.createMutate).toHaveBeenNthCalledWith(1, {
				tournamentId: "tour-1",
				level: 1,
				isBreak: false,
				minutes: 30,
			});
		});

		it("creates a minutes-less level when the minutes cell is empty", async () => {
			const user = userEvent.setup();
			render(<BlindStructureContent tournamentId="tour-1" variant="mix" />);
			await user.click(screen.getByRole("button", { name: ADD_LEVEL_PATTERN }));
			expect(mocks.createMutate).toHaveBeenCalledTimes(1);
			expect(mocks.createMutate).toHaveBeenNthCalledWith(1, {
				tournamentId: "tour-1",
				level: 1,
				isBreak: false,
			});
		});
	});
});
