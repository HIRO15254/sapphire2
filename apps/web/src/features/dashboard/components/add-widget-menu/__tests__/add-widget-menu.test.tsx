import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddWidgetMenu } from "@/features/dashboard/components/add-widget-menu/add-widget-menu";

vi.mock("@/features/dashboard/widgets/registry", () => ({
	listWidgetTypes: () => [
		{
			type: "summary_stats",
			label: "Summary Stats",
			description: "Aggregated P/L, win rate, and session counts",
			icon: () => <svg aria-hidden="true" />,
		},
		{
			type: "pnl_graph",
			label: "P&L Graph",
			description:
				"Cumulative profit and loss over time, sessions, or play time",
			icon: () => <svg aria-hidden="true" />,
		},
	],
}));

describe("AddWidgetMenu", () => {
	it("does not render the widget picker until the trigger is clicked", () => {
		render(<AddWidgetMenu onSelect={vi.fn()} />);
		expect(screen.queryByText("Summary Stats")).not.toBeInTheDocument();
	});

	it("opens the action sheet listing every widget type", async () => {
		const user = userEvent.setup();
		render(<AddWidgetMenu onSelect={vi.fn()} />);

		await user.click(screen.getByRole("button", { name: "Add widget" }));

		expect(screen.getByText("Summary Stats")).toBeInTheDocument();
		expect(screen.getByText("P&L Graph")).toBeInTheDocument();
		expect(
			screen.getByText("Aggregated P/L, win rate, and session counts")
		).toBeInTheDocument();
	});

	it("calls onSelect with the chosen type and closes the sheet", async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(<AddWidgetMenu onSelect={onSelect} />);

		await user.click(screen.getByRole("button", { name: "Add widget" }));
		await user.click(screen.getByText("P&L Graph"));

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith("pnl_graph");
	});

	it("disables the trigger when disabled is true", () => {
		render(<AddWidgetMenu disabled onSelect={vi.fn()} />);
		expect(screen.getByRole("button", { name: "Add widget" })).toBeDisabled();
	});
});
