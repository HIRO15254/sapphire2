import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlindStructureContent } from "./blind-level-editor";

const BLIND_HELPER_PATTERN = /drag levels to reorder the structure/i;
const BREAK_BUTTON_PATTERN = /break/i;
const LEVEL_BUTTON_PATTERN = /level/i;

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
	reorderMutate: vi.fn(),
	setQueryData: vi.fn(),
	updateMutate: vi.fn(),
}));

vi.mock("@dnd-kit/core", () => ({
	DndContext: ({ children }: { children: ReactNode }) => <>{children}</>,
	PointerSensor: class {},
	TouchSensor: class {},
	closestCenter: vi.fn(),
	useSensor: vi.fn(),
	useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
	SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
	arrayMove: <T,>(items: T[]) => items,
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
			options.mutationFn(arg);
		},
	}),
	// useGameGroups also calls useQuery (for trpc.gameVariant.list,
	// trpc.gameGroup.list, and trpc.gameMix.list) — branch on the queryKey so
	// it doesn't collide with the blind-levels query below.
	useQuery: (options: { queryKey?: readonly unknown[] }) => {
		if (options?.queryKey?.[0] === "gameMix") {
			return { data: mocks.gameMixes, isLoading: false };
		}
		if (options?.queryKey?.[0] === "gameVariant") {
			return { data: mocks.gameVariants, isLoading: false };
		}
		if (options?.queryKey?.[0] === "gameGroup") {
			return { data: mocks.gameGroups, isLoading: false };
		}
		return {
			data: mocks.blindLevels,
			isLoading: mocks.isLoading,
		};
	},
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
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

describe("BlindStructureContent", () => {
	beforeEach(() => {
		mocks.blindLevels = [];
		mocks.gameGroups = [];
		mocks.gameVariants = [];
		mocks.gameMixes = [];
		mocks.isLoading = false;
		mocks.createMutate.mockReset();
		mocks.deleteMutate.mockReset();
		mocks.reorderMutate.mockReset();
		mocks.updateMutate.mockReset();
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

	it("keeps flat blind headers for a mix master variant (games rotate independently of levels)", () => {
		mocks.gameMixes = [
			{ id: "m-8game", builtinKey: "8-game", label: "8-Game", games: [] },
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
		expect(screen.queryByText("Games")).not.toBeInTheDocument();
		expect(screen.getByText("SB")).toBeInTheDocument();
		expect(screen.getByText("BB")).toBeInTheDocument();
	});

	it("shows the per-level games column only for the per-level sentinel variant", () => {
		render(<BlindStructureContent tournamentId="tour-1" variant="mix" />);
		expect(screen.getByText("Games")).toBeInTheDocument();
	});

	it("offers per-level game sets on each flat row for a mix master variant", () => {
		seedMixMasterData();
		mocks.blindLevels = [
			{
				ante: null,
				blind1: 100,
				blind2: 200,
				blind3: null,
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
		expect(
			screen.getByRole("button", { name: "Use game sets" })
		).toBeInTheDocument();
	});

	it("renders one inline row per game set with the Game column header", () => {
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
		expect(screen.getByText("Game")).toBeInTheDocument();
		expect(screen.getByText("Limit games")).toBeInTheDocument();
		expect(screen.getByText("NL Hold'em")).toBeInTheDocument();
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

	it("reverts a set-based level to a single flat blind set", async () => {
		const user = userEvent.setup();
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
		await user.click(
			screen.getByRole("button", { name: "Use single blind set" })
		);
		expect(mocks.updateMutate).toHaveBeenCalledTimes(1);
		expect(mocks.updateMutate).toHaveBeenNthCalledWith(1, {
			id: "l1",
			games: null,
		});
	});

	it("seeds a flat level with the composition's game sets from the row toggle", async () => {
		const user = userEvent.setup();
		seedMixMasterData();
		mocks.blindLevels = [
			{
				ante: null,
				blind1: 100,
				blind2: 200,
				blind3: null,
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="8-Game" />);
		await user.click(screen.getByRole("button", { name: "Use game sets" }));
		expect(mocks.updateMutate).toHaveBeenCalledTimes(1);
		expect(mocks.updateMutate).toHaveBeenNthCalledWith(1, {
			id: "l1",
			games: [
				expect.objectContaining({ variants: ["NL Hold'em"] }),
				expect.objectContaining({ variants: ["Razz"] }),
			],
		});
	});

	it("does not offer per-level game sets for a plain variant", () => {
		mocks.blindLevels = [
			{
				ante: null,
				blind1: 100,
				blind2: 200,
				blind3: null,
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
				tournamentId: "tour-1",
			},
		];
		render(<BlindStructureContent tournamentId="tour-1" variant="nlh" />);
		expect(
			screen.queryByRole("button", { name: "Use game sets" })
		).not.toBeInTheDocument();
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
});
