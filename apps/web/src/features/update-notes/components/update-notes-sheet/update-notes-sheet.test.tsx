import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateNotesSheet } from "./update-notes-sheet";

const mocks = vi.hoisted(() => ({
	sheetState: {
		isOpen: true,
		open: vi.fn(),
		close: vi.fn(),
		setIsOpen: vi.fn(),
		viewedVersions: new Set<string>(),
		onAccordionChange: vi.fn(),
	},
}));

vi.mock(
	"@/features/update-notes/components/update-notes-sheet/use-update-notes-sheet",
	() => ({
		useUpdateNotesSheet: () => mocks.sheetState,
	})
);

vi.mock("@/features/update-notes/constants", () => ({
	UPDATE_NOTES: [
		{
			version: "1.0.0",
			releasedAt: "2026-04-11",
			title: "Update Notes Feature",
			changes: [
				{
					section: "New Features",
					items: ["Added update notes modal to view past release information"],
				},
				{
					section: "UI Improvements",
					items: [
						"Unviewed updates are highlighted with a NEW badge",
						"Update notes sheet automatically opens after a new release",
					],
				},
				{
					section: "",
					items: ["orphan bullet"],
				},
			],
		},
	],
	LATEST_VERSION: "1.0.0",
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
	beforeEach(() => {
		mocks.sheetState.isOpen = true;
		mocks.sheetState.viewedVersions = new Set();
		mocks.sheetState.setIsOpen.mockClear();
	});

	it("mounts the drawer content only while open", () => {
		mocks.sheetState.isOpen = false;
		const { rerender } = render(<UpdateNotesSheet />);
		expect(screen.queryByText("Update notes")).not.toBeInTheDocument();
		mocks.sheetState.isOpen = true;
		rerender(<UpdateNotesSheet />);
		expect(screen.getByText("Update notes")).toBeInTheDocument();
	});

	it("renders one accordion item per update note with its version and release date", () => {
		render(<UpdateNotesSheet />);
		expect(screen.getAllByTestId("accordion-item")).toHaveLength(1);
		expect(screen.getByText("1.0.0")).toBeInTheDocument();
		expect(screen.getByText("2026-04-11")).toBeInTheDocument();
	});

	it("shows the NEW badge only for unviewed versions", () => {
		const { rerender } = render(<UpdateNotesSheet />);
		expect(screen.getByTestId("badge")).toHaveTextContent("NEW");
		mocks.sheetState.viewedVersions = new Set(["1.0.0"]);
		rerender(<UpdateNotesSheet />);
		expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
	});

	it("renders one bullet per change item", () => {
		render(<UpdateNotesSheet />);
		expect(
			screen.getAllByRole("listitem").map((item) => item.textContent)
		).toEqual([
			"Added update notes modal to view past release information",
			"Unviewed updates are highlighted with a NEW badge",
			"Update notes sheet automatically opens after a new release",
			"orphan bullet",
		]);
	});

	it("renders a heading only for labeled sections", () => {
		render(<UpdateNotesSheet />);
		expect(screen.getByText("New Features")).toBeInTheDocument();
		expect(screen.getByText("UI Improvements")).toBeInTheDocument();
		expect(
			screen.getByText("orphan bullet").closest("div")?.querySelector("p")
		).toBeNull();
	});

	it("requests close via setIsOpen(false) when Escape is pressed", async () => {
		const user = userEvent.setup();
		render(<UpdateNotesSheet />);
		await user.keyboard("{Escape}");
		expect(mocks.sheetState.setIsOpen).toHaveBeenCalledTimes(1);
		expect(mocks.sheetState.setIsOpen).toHaveBeenCalledWith(false);
	});
});
