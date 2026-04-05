import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResponsiveDialog } from "../responsive-dialog";

const mockUseMediaQuery = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-media-query", () => ({
	useMediaQuery: mockUseMediaQuery,
}));

describe("ResponsiveDialog", () => {
	it("renders description in desktop mode", () => {
		mockUseMediaQuery.mockReturnValue(true);

		render(
			<ResponsiveDialog
				description="Desktop description"
				onOpenChange={vi.fn()}
				open
				title="Desktop Title"
			>
				<div>Desktop content</div>
			</ResponsiveDialog>
		);

		expect(screen.getByText("Desktop Title")).toBeInTheDocument();
		expect(screen.getByText("Desktop description")).toBeInTheDocument();
		expect(screen.getByText("Desktop content")).toBeInTheDocument();
	});

	it("renders description in mobile mode", () => {
		mockUseMediaQuery.mockReturnValue(false);

		render(
			<ResponsiveDialog
				description="Mobile description"
				onOpenChange={vi.fn()}
				open
				title="Mobile Title"
			>
				<div>Mobile content</div>
			</ResponsiveDialog>
		);

		expect(screen.getByText("Mobile Title")).toBeInTheDocument();
		expect(screen.getByText("Mobile description")).toBeInTheDocument();
		expect(screen.getByText("Mobile content")).toBeInTheDocument();
	});

	it("omits the description when none is provided", () => {
		mockUseMediaQuery.mockReturnValue(true);

		render(
			<ResponsiveDialog onOpenChange={vi.fn()} open title="No Description">
				<div>Dialog content</div>
			</ResponsiveDialog>
		);

		expect(screen.getByText("No Description")).toBeInTheDocument();
		expect(screen.queryByText("Desktop description")).not.toBeInTheDocument();
		expect(screen.getByText("Dialog content")).toBeInTheDocument();
	});
});
