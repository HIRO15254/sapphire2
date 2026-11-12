import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconPicker } from "./icon-picker";

const NONE = /none/iu;

describe("IconPicker", () => {
	it("reports the picked icon name and closes the sheet", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(<IconPicker onValueChange={onValueChange} value="" />);
		const trigger = screen.getByRole("button", { name: NONE });

		await user.click(trigger);
		await user.type(
			await screen.findByRole("searchbox", { name: "Search icons" }),
			"money"
		);
		await user.click(await screen.findByRole("button", { name: "Wallet" }));

		expect(onValueChange).toHaveBeenCalledWith("wallet");
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});

	it("treats a name missing from the font as no icon and lets None clear it", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(
			<IconPicker
				onValueChange={onValueChange}
				value="not-a-tabler-icon"
				variant="icon"
			/>
		);

		const trigger = await screen.findByRole("button", { name: "Icon: None" });
		await user.click(trigger);
		await user.click(await screen.findByRole("button", { name: "None" }));

		expect(onValueChange).toHaveBeenCalledWith("");
	});
});
