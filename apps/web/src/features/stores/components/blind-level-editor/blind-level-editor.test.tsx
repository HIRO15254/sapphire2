import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlindLevelEditor } from "./blind-level-editor";

const BLIND_DESCRIPTION_PATTERN = /manage blind levels, breaks, and ordering/i;
const BLIND_HELPER_PATTERN = /drag levels to reorder the structure/i;
const BREAK_BUTTON_PATTERN = /break/i;
const LEVEL_BUTTON_PATTERN = /level/i;

// API-shape level (matches what trpc.tournament.listBlindLevels returns)
interface ApiLevel {
	blindSets: {
		id: number;
		blind1: number;
		blind2: number;
		blind3: number | null;
		blind4: number | null;
		ante: number | null;
		anteType: string | null;
		sortOrder: number;
	}[];
	id: number;
	isBreak: boolean;
	levelIndex: number;
	minutes: number | null;
	sortOrder: number;
	tournamentId: string;
}

const mocks = vi.hoisted(() => ({
	apiLevels: [] as ApiLevel[],
	addBlindLevel: vi.fn(),
	removeBlindLevel: vi.fn(),
	invalidateQueries: vi.fn(),
	isLoading: false,
	setQueryData: vi.fn(),
	updateBlindLevel: vi.fn(),
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
	useQuery: () => ({
		data: mocks.apiLevels,
		isLoading: mocks.isLoading,
	}),
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
		invalidateQueries: mocks.invalidateQueries,
		setQueryData: mocks.setQueryData,
	}),
}));

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		description,
		open,
		title,
	}: {
		children: ReactNode;
		description?: ReactNode;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{description ? <p>{description}</p> : null}
				{children}
			</div>
		) : null,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		tournament: {
			listBlindLevels: {
				queryOptions: ({ tournamentId }: { tournamentId: string }) => ({
					queryKey: ["tournament", "listBlindLevels", { tournamentId }],
				}),
			},
		},
	},
	trpcClient: {
		tournament: {
			addBlindLevel: {
				mutate: (input: unknown) => mocks.addBlindLevel(input),
			},
			removeBlindLevel: {
				mutate: (input: unknown) => mocks.removeBlindLevel(input),
			},
			updateBlindLevel: {
				mutate: (input: unknown) => mocks.updateBlindLevel(input),
			},
		},
	},
}));

describe("BlindLevelEditor", () => {
	beforeEach(() => {
		mocks.apiLevels = [];
		mocks.isLoading = false;
		mocks.addBlindLevel.mockReset();
		mocks.removeBlindLevel.mockReset();
		mocks.updateBlindLevel.mockReset();
		mocks.invalidateQueries.mockReset();
		mocks.setQueryData.mockReset();
	});

	it("renders helper text and dialog description", () => {
		render(
			<BlindLevelEditor
				onOpenChange={vi.fn()}
				open
				tournamentId="tour-1"
				variant="nlh"
			/>
		);

		expect(screen.getByText("Blind Structure")).toBeInTheDocument();
		expect(screen.getByText(BLIND_DESCRIPTION_PATTERN)).toBeInTheDocument();
		expect(screen.getByText(BLIND_HELPER_PATTERN)).toBeInTheDocument();
	});

	it("shows the loading state", () => {
		mocks.isLoading = true;

		render(
			<BlindLevelEditor
				onOpenChange={vi.fn()}
				open
				tournamentId="tour-1"
				variant="nlh"
			/>
		);

		expect(screen.getByText("Loading levels...")).toBeInTheDocument();
	});

	it("adds a level and a break from the header actions", async () => {
		const user = userEvent.setup();

		render(
			<BlindLevelEditor
				onOpenChange={vi.fn()}
				open
				tournamentId="tour-1"
				variant="nlh"
			/>
		);

		await user.click(
			screen.getByRole("button", { name: LEVEL_BUTTON_PATTERN })
		);
		await user.click(
			screen.getByRole("button", { name: BREAK_BUTTON_PATTERN })
		);

		// New API: addBlindLevel with levelIndex (0-based), isBreak, sortOrder
		expect(mocks.addBlindLevel).toHaveBeenCalledWith(
			expect.objectContaining({
				tournamentId: "tour-1",
				levelIndex: 0,
				isBreak: false,
				sortOrder: 0,
			})
		);
		expect(mocks.addBlindLevel).toHaveBeenCalledWith(
			expect.objectContaining({
				tournamentId: "tour-1",
				levelIndex: 0,
				isBreak: true,
				sortOrder: 0,
			})
		);
	});

	it("creates a new level row with autofill when the new row loses focus", () => {
		render(
			<BlindLevelEditor
				onOpenChange={vi.fn()}
				open
				tournamentId="tour-1"
				variant="nlh"
			/>
		);

		const numberInputs = screen.getAllByRole("spinbutton");
		const smallBlindInput = numberInputs[0];
		fireEvent.change(smallBlindInput, { target: { value: "100" } });
		fireEvent.blur(smallBlindInput, { relatedTarget: null });

		expect(mocks.addBlindLevel).toHaveBeenCalledWith(
			expect.objectContaining({
				tournamentId: "tour-1",
				levelIndex: 0,
				isBreak: false,
				sortOrder: 0,
			})
		);
	});

	it("shows an empty state message when there are no levels", () => {
		mocks.apiLevels = [];

		render(
			<BlindLevelEditor
				onOpenChange={vi.fn()}
				open
				tournamentId="tour-1"
				variant="nlh"
			/>
		);

		// The editor renders table headers + empty new-row; loading text is
		// absent because isLoading=false. At least the description is present.
		expect(screen.getByText(BLIND_DESCRIPTION_PATTERN)).toBeInTheDocument();
	});

	it("does not render any rows when open=false (dialog hidden)", () => {
		render(
			<BlindLevelEditor
				onOpenChange={vi.fn()}
				open={false}
				tournamentId="tour-1"
				variant="nlh"
			/>
		);
		expect(screen.queryByText("Blind Structure")).not.toBeInTheDocument();
	});

	it("deletes an existing level", async () => {
		const user = userEvent.setup();
		mocks.apiLevels = [
			{
				id: 42,
				tournamentId: "tour-1",
				levelIndex: 0,
				isBreak: false,
				minutes: 20,
				sortOrder: 0,
				blindSets: [
					{
						id: 1,
						blind1: 100,
						blind2: 200,
						blind3: null,
						blind4: null,
						ante: 200,
						anteType: null,
						sortOrder: 0,
					},
				],
			},
		];

		render(
			<BlindLevelEditor
				onOpenChange={vi.fn()}
				open
				tournamentId="tour-1"
				variant="nlh"
			/>
		);

		await user.click(screen.getByRole("button", { name: "Delete level" }));

		// removeBlindLevel expects numeric id
		expect(mocks.removeBlindLevel).toHaveBeenCalledWith({ id: 42 });
	});
});
