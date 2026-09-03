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
	it.each([2, 3, 4])("sets --tabs-count=%i", (count) => {
		renderTabs(
			Array.from({ length: count }, (_, i) => String.fromCharCode(97 + i))
		);
		expect(
			screen.getByRole("tablist").style.getPropertyValue("--tabs-count")
		).toBe(String(count));
	});

	it("renders every trigger for a three-tab list", () => {
		renderTabs(["a", "b", "c"]);
		expect(screen.getAllByRole("tab")).toHaveLength(3);
	});
});
