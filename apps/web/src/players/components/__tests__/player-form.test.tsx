import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerForm } from "../player-form";

const VIP_TAG = { color: "blue", id: "vip", name: "VIP" };

vi.mock("@/shared/components/ui/rich-text-editor", () => ({
	RichTextEditor: ({
		initialContent,
		onChange,
	}: {
		initialContent?: string | null;
		onChange: (value: string) => void;
	}) => (
		<textarea
			aria-label="Memo"
			defaultValue={initialContent ?? ""}
			onChange={(event) => onChange(event.target.value)}
		/>
	),
}));

describe("PlayerForm", () => {
	it("submits selected tag ids without changing the payload shape", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<PlayerForm availableTags={[VIP_TAG]} onSubmit={onSubmit} />);

		await user.type(screen.getByLabelText("Player Name *"), "Alice");
		await user.type(screen.getByLabelText("Memo"), "Tough regular");
		await user.click(screen.getByLabelText("Search player tags"));
		await user.click(screen.getByText("VIP"));
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith({
			memo: "Tough regular",
			name: "Alice",
			tagIds: ["vip"],
		});
	});
});
