import { render, screen } from "@testing-library/react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "./drawer";

function stubVisualViewport(height: number) {
	const viewport = Object.assign(new EventTarget(), { height });
	const original = Object.getOwnPropertyDescriptor(window, "visualViewport");
	Object.defineProperty(window, "visualViewport", {
		configurable: true,
		value: viewport,
	});
	onTestFinished(() => {
		if (original) {
			Object.defineProperty(window, "visualViewport", original);
		} else {
			Reflect.deleteProperty(window, "visualViewport");
		}
	});
	return viewport;
}

describe("Drawer", () => {
	it("leaves the sheet's size to the browser when the on-screen keyboard opens", () => {
		const viewport = stubVisualViewport(window.innerHeight);
		render(
			<Drawer onOpenChange={vi.fn()} open>
				<DrawerContent>
					<DrawerTitle>Sheet</DrawerTitle>
					<DrawerDescription>Sheet</DrawerDescription>
					<input aria-label="Name" />
				</DrawerContent>
			</Drawer>
		);

		screen.getByRole("textbox", { name: "Name" }).focus();
		viewport.height = window.innerHeight - 300;
		viewport.dispatchEvent(new Event("resize"));

		const sheet = screen.getByRole("dialog");
		expect(sheet.style.height).toBe("");
		expect(sheet.style.bottom).toBe("");
	});
});
