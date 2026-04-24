import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			list: { queryOptions: () => ({ queryKey: ["session-list"] }) },
		},
		liveCashGameSession: {
			list: { queryOptions: () => ({ queryKey: ["live-cash-list"] }) },
		},
		liveTournamentSession: {
			list: { queryOptions: () => ({ queryKey: ["live-tournament-list"] }) },
		},
		currency: {
			list: { queryOptions: () => ({ queryKey: ["currency-list"] }) },
		},
		dashboardWidget: {
			list: { queryOptions: () => ({ queryKey: ["widget-list"] }) },
		},
	},
	trpcClient: {},
}));

const EDIT_LABEL_PATTERN = /Edit/;
const DELETE_LABEL_PATTERN = /Delete/;
const DRAG_LABEL_PATTERN = /^Drag/;

const { DashboardWidget } = await import(
	"@/features/dashboard/components/dashboard-widget"
);

describe("DashboardWidget", () => {
	it("hides edit/delete controls when not editing", () => {
		render(
			<DashboardWidget id="w1" isEditing={false} type="summary_stats">
				<div>inner</div>
			</DashboardWidget>
		);
		expect(screen.queryByLabelText(EDIT_LABEL_PATTERN)).toBeNull();
		expect(screen.queryByLabelText(DELETE_LABEL_PATTERN)).toBeNull();
	});

	it("shows edit/delete buttons when editing and fires handlers", async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		const onDelete = vi.fn();
		render(
			<DashboardWidget
				id="w1"
				isEditing
				onDelete={onDelete}
				onEdit={onEdit}
				type="summary_stats"
			>
				<div>inner</div>
			</DashboardWidget>
		);
		await user.click(screen.getByLabelText(EDIT_LABEL_PATTERN));
		await user.click(screen.getByLabelText(DELETE_LABEL_PATTERN));
		expect(onEdit).toHaveBeenCalledOnce();
		expect(onDelete).toHaveBeenCalledOnce();
	});

	it("renders the widget type label in the header", () => {
		render(
			<DashboardWidget id="w1" isEditing={false} type="summary_stats">
				<div>inner</div>
			</DashboardWidget>
		);
		expect(screen.getByText("Summary Stats")).toBeInTheDocument();
	});

	it("renders the children content in all modes", () => {
		render(
			<DashboardWidget id="w1" isEditing={false} type="summary_stats">
				<div data-testid="inner">stats here</div>
			</DashboardWidget>
		);
		expect(screen.getByTestId("inner")).toHaveTextContent("stats here");
	});

	it("shows a drag handle only when editing", () => {
		const { rerender } = render(
			<DashboardWidget id="w1" isEditing={false} type="summary_stats">
				<div />
			</DashboardWidget>
		);
		expect(screen.queryByLabelText(DRAG_LABEL_PATTERN)).toBeNull();

		rerender(
			<DashboardWidget id="w1" isEditing type="summary_stats">
				<div />
			</DashboardWidget>
		);
		expect(screen.getByLabelText(DRAG_LABEL_PATTERN)).toBeInTheDocument();
	});

	it("does not render edit button when onEdit is not provided (even in edit mode)", () => {
		render(
			<DashboardWidget id="w1" isEditing type="summary_stats">
				<div />
			</DashboardWidget>
		);
		expect(screen.queryByLabelText(EDIT_LABEL_PATTERN)).toBeNull();
	});

	it("does not render delete button when onDelete is not provided (even in edit mode)", () => {
		render(
			<DashboardWidget id="w1" isEditing type="summary_stats">
				<div />
			</DashboardWidget>
		);
		expect(screen.queryByLabelText(DELETE_LABEL_PATTERN)).toBeNull();
	});
});
