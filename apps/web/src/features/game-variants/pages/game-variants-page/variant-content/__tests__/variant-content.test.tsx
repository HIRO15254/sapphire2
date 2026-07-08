import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameVariantRow } from "../../types";
import { VariantContent } from "../variant-content";

function variant(overrides: Partial<GameVariantRow> = {}): GameVariantRow {
	return {
		archivedAt: null,
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
		id: "v1",
		name: "NLH",
		sortOrder: 0,
		...overrides,
	};
}

function renderContent(
	overrides: Partial<React.ComponentProps<typeof VariantContent>> = {}
) {
	render(
		<VariantContent
			activeVariants={[]}
			archivedVariants={[]}
			isLoading={false}
			onArchive={vi.fn()}
			onDelete={vi.fn()}
			onEdit={vi.fn()}
			onRestore={vi.fn()}
			showArchived={false}
			{...overrides}
		/>
	);
}

describe("VariantContent", () => {
	it("renders the loading skeleton (not the empty state) while isLoading is true", () => {
		renderContent({ isLoading: true });
		expect(screen.getByTestId("variant-list-skeleton")).toBeInTheDocument();
		expect(screen.queryByText("No game variants yet.")).not.toBeInTheDocument();
	});

	it("shows the empty state when there are no active variants and archived is hidden", () => {
		renderContent({ activeVariants: [], showArchived: false });
		expect(screen.getByText("No game variants yet.")).toBeInTheDocument();
	});

	it("does not show the active-empty message when archived is shown, even with no active variants", () => {
		renderContent({ activeVariants: [], showArchived: true });
		expect(screen.queryByText("No game variants yet.")).not.toBeInTheDocument();
	});

	it("renders a row per active variant", () => {
		renderContent({
			activeVariants: [
				variant({ id: "v1", name: "NLH" }),
				variant({ id: "v2", name: "PLO" }),
			],
		});
		expect(screen.getByText("NLH")).toBeInTheDocument();
		expect(screen.getByText("PLO")).toBeInTheDocument();
	});

	it("does not render the archived section when showArchived is false", () => {
		renderContent({
			showArchived: false,
			archivedVariants: [variant({ id: "v1", name: "Retired" })],
		});
		expect(screen.queryByText("Archived")).not.toBeInTheDocument();
		expect(screen.queryByText("Retired")).not.toBeInTheDocument();
	});

	it("shows the archived-empty message when showArchived is true and there are no archived variants", () => {
		renderContent({ showArchived: true, archivedVariants: [] });
		expect(screen.getByText("Archived")).toBeInTheDocument();
		expect(screen.getByText("No archived game variants.")).toBeInTheDocument();
	});

	it("renders a row per archived variant when showArchived is true", () => {
		renderContent({
			showArchived: true,
			archivedVariants: [
				variant({
					id: "v1",
					name: "Retired",
					archivedAt: "2026-01-01T00:00:00.000Z",
				}),
			],
		});
		expect(screen.getByText("Retired")).toBeInTheDocument();
		expect(
			screen.queryByText("No archived game variants.")
		).not.toBeInTheDocument();
	});

	it("renders both active rows and archived rows together when showArchived is true", () => {
		renderContent({
			activeVariants: [variant({ id: "v1", name: "NLH" })],
			showArchived: true,
			archivedVariants: [
				variant({
					id: "v2",
					name: "Retired",
					archivedAt: "2026-01-01T00:00:00.000Z",
				}),
			],
		});
		expect(screen.getByText("NLH")).toBeInTheDocument();
		expect(screen.getByText("Retired")).toBeInTheDocument();
	});
});
