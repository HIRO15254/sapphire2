import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function renderTabs(values: string[]) {
	return render(
		<Tabs defaultValue={values[0]}>
			<TabsList>
				{values.map((v) => (
					<TabsTrigger key={v} value={v}>
						{v}
					</TabsTrigger>
				))}
			</TabsList>
			{values.map((v) => (
				<TabsContent key={v} value={v}>
					{`content-${v}`}
				</TabsContent>
			))}
		</Tabs>
	);
}

describe("Tabs", () => {
	it("sets --tabs-count from the number of triggers (2)", () => {
		renderTabs(["a", "b"]);
		expect(
			screen.getByRole("tablist").style.getPropertyValue("--tabs-count")
		).toBe("2");
	});

	it("sets --tabs-count for three tabs", () => {
		renderTabs(["a", "b", "c"]);
		expect(
			screen.getByRole("tablist").style.getPropertyValue("--tabs-count")
		).toBe("3");
	});

	it("sets --tabs-count for four tabs", () => {
		renderTabs(["a", "b", "c", "d"]);
		expect(
			screen.getByRole("tablist").style.getPropertyValue("--tabs-count")
		).toBe("4");
	});

	it("renders every trigger for a three-tab list", () => {
		renderTabs(["a", "b", "c"]);
		expect(screen.getAllByRole("tab")).toHaveLength(3);
	});
});
