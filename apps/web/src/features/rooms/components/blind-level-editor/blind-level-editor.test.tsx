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
		id: string;
		isBreak: boolean;
		level: number;
		minutes: number | null;
		tournamentId: string;
	}>,
	createMutate: vi.fn(),
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
	// useVariantLabels also calls useQuery (for trpc.gameVariant.list) — branch
	// on the queryKey so it doesn't collide with the blind-levels query below.
	useQuery: (options: { queryKey?: readonly unknown[] }) => {
		if (options?.queryKey?.[0] === "gameVariant") {
			return { data: [], isLoading: false };
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

describe("BlindStructureContent", () => {
	beforeEach(() => {
		mocks.blindLevels = [];
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
});
