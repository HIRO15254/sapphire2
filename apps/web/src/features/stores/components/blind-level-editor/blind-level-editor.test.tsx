import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlindLevelEditor } from "./blind-level-editor";

const BLIND_DESCRIPTION_PATTERN = /manage blind levels, breaks, and ordering/i;
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
	useQuery: () => ({
		data: mocks.blindLevels,
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
		blindLevel: {
			listByTournament: {
				queryOptions: ({ tournamentId }: { tournamentId: string }) => ({
					queryKey: ["blindLevel.listByTournament", tournamentId],
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

describe("BlindLevelEditor", () => {
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

		expect(mocks.createMutate).toHaveBeenCalledWith({
			ante: 200,
			blind1: 100,
			blind2: 200,
			isBreak: false,
			level: 1,
			tournamentId: "tour-1",
		});
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

		render(
			<BlindLevelEditor
				onOpenChange={vi.fn()}
				open
				tournamentId="tour-1"
				variant="nlh"
			/>
		);

		await user.click(screen.getByRole("button", { name: "Delete level" }));

		expect(mocks.deleteMutate).toHaveBeenCalledWith({ id: "level-1" });
	});
});
