import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventBadge } from "./event-badge";

describe("EventBadge", () => {
	it("uses a native button so keyboard users can edit an event", async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		render(<EventBadge data={{ amount: 100 }} onEdit={onEdit} type="addon" />);

		const button = screen.getByRole("button", { name: "Addon: 100" });
		button.focus();
		await user.keyboard("{Enter}");
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onEdit).toHaveBeenCalledWith();
		await user.keyboard(" ");
		expect(onEdit).toHaveBeenCalledTimes(2);
	});
});
