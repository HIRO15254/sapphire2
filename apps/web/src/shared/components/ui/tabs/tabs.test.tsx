import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function renderTabs() {
	return render(
		<Tabs defaultValue="details">
			<TabsList aria-label="Tournament editor">
				<TabsTrigger value="details">Details</TabsTrigger>
				<TabsTrigger disabled value="locked">
					Locked
				</TabsTrigger>
				<TabsTrigger value="structure">Structure</TabsTrigger>
			</TabsList>
			<TabsContent value="details">Tournament details</TabsContent>
			<TabsContent value="locked">Unavailable</TabsContent>
			<TabsContent value="structure">Blind levels</TabsContent>
		</Tabs>
	);
}

describe("Tabs", () => {
	it("switches the labelled panel when a tab is clicked", async () => {
		const user = userEvent.setup();
		renderTabs();
		expect(screen.getByRole("tabpanel", { name: "Details" })).toHaveTextContent(
			"Tournament details"
		);
		await user.click(screen.getByRole("tab", { name: "Structure" }));
		expect(screen.getByRole("tab", { name: "Structure" })).toHaveAttribute(
			"aria-selected",
			"true"
		);
		expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute(
			"aria-selected",
			"false"
		);
		expect(
			screen.getByRole("tabpanel", { name: "Structure" })
		).toHaveTextContent("Blind levels");
		expect(
			screen.queryByRole("tabpanel", { name: "Details" })
		).not.toBeInTheDocument();
	});

	it("supports keyboard selection while skipping a disabled tab", async () => {
		const user = userEvent.setup();
		renderTabs();
		await user.tab();
		expect(screen.getByRole("tab", { name: "Details" })).toHaveFocus();
		await user.keyboard("{ArrowRight}");
		expect(screen.getByRole("tab", { name: "Structure" })).toHaveFocus();
		expect(screen.getByRole("tabpanel", { name: "Structure" })).toBeVisible();
		await user.keyboard("{Home}");
		expect(screen.getByRole("tab", { name: "Details" })).toHaveFocus();
		expect(screen.getByRole("tab", { name: "Locked" })).toBeDisabled();
		expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
	});
});
