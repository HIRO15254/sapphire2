import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UpdateNotesSheet } from "./update-notes-sheet";

const mocks = vi.hoisted(() => ({
	sheetState: {
		isOpen: true,
		open: vi.fn(),
		close: vi.fn(),
		setIsOpen: vi.fn(),
		viewedVersions: new Set<string>(),
		markViewed: vi.fn(),
	},
}));

vi.mock(
	"@/features/update-notes/components/update-notes-sheet/use-update-notes-sheet",
	() => ({
		useUpdateNotesSheet: () => mocks.sheetState,
	})
);

const RELEASE_ROW = /1\.0\.0/;

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

vi.mock("@/shared/components/ui/badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) => (
		<span data-testid="badge">{children}</span>
	),
}));

describe("UpdateNotesSheet", () => {
	it("renders the drawer with the Update notes title when open", () => {
		mocks.sheetState.isOpen = true;
		render(<UpdateNotesSheet />);
		expect(screen.getByText("Update notes")).toBeInTheDocument();
	});

	it("does not render when closed", () => {
		mocks.sheetState.isOpen = false;
		render(<UpdateNotesSheet />);
		expect(screen.queryByText("Update notes")).not.toBeInTheDocument();
	});

	it("expands a release and marks it viewed", async () => {
		mocks.sheetState.isOpen = true;
		mocks.sheetState.viewedVersions = new Set();
		mocks.sheetState.markViewed.mockClear();
		render(<UpdateNotesSheet />);
		const release = screen.getByRole("button", { name: RELEASE_ROW });
		expect(release).toHaveAttribute("aria-expanded", "false");
		expect(release).toHaveTextContent("New");
		expect(release).toHaveTextContent("2026/04/11");
		expect(screen.queryByText("Update Notes Feature")).not.toBeInTheDocument();
		await userEvent.setup().click(release);
		expect(release).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Update Notes Feature")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Added update notes modal to view past release information"
			)
		).toBeInTheDocument();
		expect(mocks.sheetState.markViewed).toHaveBeenCalledWith("1.0.0");
	});

	it("does not show NEW badge for viewed versions", () => {
		mocks.sheetState.isOpen = true;
		mocks.sheetState.viewedVersions = new Set(["1.0.0"]);
		render(<UpdateNotesSheet />);
		expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
	});

	it("does not render drawer content when isOpen=false even if a version is viewed", () => {
		mocks.sheetState.isOpen = false;
		mocks.sheetState.viewedVersions = new Set(["1.0.0"]);
		render(<UpdateNotesSheet />);
		expect(screen.queryByText("Update notes")).not.toBeInTheDocument();
	});

	it("requests close via setIsOpen(false) when Escape is pressed", async () => {
		const user = userEvent.setup();
		mocks.sheetState.isOpen = true;
		mocks.sheetState.setIsOpen.mockClear();
		render(<UpdateNotesSheet />);

		await user.keyboard("{Escape}");

		expect(mocks.sheetState.setIsOpen).toHaveBeenCalledTimes(1);
		expect(mocks.sheetState.setIsOpen).toHaveBeenCalledWith(false);
	});
});
