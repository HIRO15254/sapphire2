import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerForm } from "./player-form";

const VIP_TAG = { color: "blue", id: "vip", name: "VIP" };
const SAVING_BUTTON_PATTERN = /Saving\.\.\./i;

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

	it("does not call onSubmit when the player name is empty (Zod onSubmit validation)", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<PlayerForm availableTags={[VIP_TAG]} onSubmit={onSubmit} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits with tagIds undefined and memo null when only the name is typed", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<PlayerForm onSubmit={onSubmit} />);

		await user.type(screen.getByLabelText("Player Name *"), "Solo");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith({
			memo: null,
			name: "Solo",
			tagIds: undefined,
		});
	});

	it("shows a disabled Saving... button while isLoading=true", () => {
		render(
			<PlayerForm availableTags={[VIP_TAG]} isLoading onSubmit={vi.fn()} />
		);
		const button = screen.getByRole("button", { name: SAVING_BUTTON_PATTERN });
		expect(button).toBeDisabled();
	});
});
