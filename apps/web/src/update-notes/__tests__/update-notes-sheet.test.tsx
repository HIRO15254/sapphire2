import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdateNotesSheet } from "../components/update-notes-sheet";

const mocks = vi.hoisted(() => ({
	sheetState: {
		isOpen: true,
		open: vi.fn(),
		close: vi.fn(),
		setIsOpen: vi.fn(),
	},
	viewedList: [] as Array<{ id: string; version: string; viewedAt: Date }>,
	markViewedMutate: vi.fn(),
}));

vi.mock("@/update-notes/hooks/use-update-notes-sheet", () => ({
	useUpdateNotesSheet: () => mocks.sheetState,
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({ data: mocks.viewedList }),
	useMutation: () => ({ mutate: mocks.markViewedMutate }),
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
		setQueryData: vi.fn(),
		invalidateQueries: vi.fn(),
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		updateNoteView: {
			list: { queryOptions: () => ({ queryKey: ["updateNoteView", "list"] }) },
			markViewed: {
				mutationOptions: (opts: unknown) => opts,
			},
			getLatestViewedVersion: {
				queryOptions: () => ({
					queryKey: ["updateNoteView", "getLatestViewedVersion"],
				}),
			},
		},
	},
}));

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		title,
		open,
	}: {
		children: React.ReactNode;
		title: string;
		open: boolean;
	}) =>
		open ? (
			<div data-testid="dialog">
				<h2>{title}</h2>
				{children}
			</div>
		) : null,
}));

vi.mock("@/shared/components/ui/accordion", () => ({
	Accordion: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="accordion">{children}</div>
	),
	AccordionItem: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="accordion-item">{children}</div>
	),
	AccordionTrigger: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
	AccordionContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/shared/components/ui/badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) => (
		<span data-testid="badge">{children}</span>
	),
}));

describe("UpdateNotesSheet", () => {
	it("renders the dialog with title when open", () => {
		mocks.sheetState.isOpen = true;
		render(<UpdateNotesSheet />);
		expect(screen.getByText("Update Notes")).toBeInTheDocument();
	});

	it("does not render when closed", () => {
		mocks.sheetState.isOpen = false;
		render(<UpdateNotesSheet />);
		expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
	});

	it("renders accordion items for update notes", () => {
		mocks.sheetState.isOpen = true;
		mocks.viewedList = [];
		render(<UpdateNotesSheet />);
		expect(screen.getByText("1.0.0")).toBeInTheDocument();
		expect(screen.getByText("2026-04-11")).toBeInTheDocument();
	});

	it("shows NEW badge for unviewed versions", () => {
		mocks.sheetState.isOpen = true;
		mocks.viewedList = [];
		render(<UpdateNotesSheet />);
		expect(screen.getByTestId("badge")).toHaveTextContent("NEW");
	});

	it("does not show NEW badge for viewed versions", () => {
		mocks.sheetState.isOpen = true;
		mocks.viewedList = [{ id: "1", version: "1.0.0", viewedAt: new Date() }];
		render(<UpdateNotesSheet />);
		expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
	});

	it("renders change items in accordion content", () => {
		mocks.sheetState.isOpen = true;
		render(<UpdateNotesSheet />);
		expect(
			screen.getByText(
				"Added update notes modal to view past release information"
			)
		).toBeInTheDocument();
	});
});
