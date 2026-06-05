import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerFormV2 } from "./player-form-v2";

const VIP_TAG = { color: "blue", id: "vip", name: "VIP" };
const FORM_ID = "player-form-v2-test";
const SAVE_RE = /save/i;

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

// The V2 form renders no submit button of its own — the surrounding FormSheet
// owns Save and submits via the `form` attribute. Mirror that with an external
// button so the test exercises the `id={formId}` wiring.
function renderForm(props: Partial<React.ComponentProps<typeof PlayerFormV2>>) {
	const onSubmit = props.onSubmit ?? vi.fn();
	render(
		<>
			<PlayerFormV2 formId={FORM_ID} onSubmit={onSubmit} {...props} />
			<button form={FORM_ID} type="submit">
				submit-trigger
			</button>
		</>
	);
	return { onSubmit };
}

describe("PlayerFormV2", () => {
	it("assigns the formId to the rendered form element", () => {
		renderForm({});
		const form = document.getElementById(FORM_ID);
		expect(form).not.toBeNull();
		expect(form?.tagName).toBe("FORM");
	});

	it("renders no submit button of its own", () => {
		renderForm({});
		expect(
			screen.queryByRole("button", { name: SAVE_RE })
		).not.toBeInTheDocument();
		// Only the external test button exists.
		expect(
			screen.getByRole("button", { name: "submit-trigger" })
		).toBeInTheDocument();
	});

	it("submits name, memo, and selected tag ids via the external Save button", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({ availableTags: [VIP_TAG] });

		await user.type(screen.getByLabelText("Player name *"), "Alice");
		await user.type(screen.getByLabelText("Memo"), "Tough regular");
		await user.click(screen.getByLabelText("Search player tags"));
		await user.click(screen.getByText("VIP"));
		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			memo: "Tough regular",
			name: "Alice",
			tagIds: ["vip"],
		});
	});

	it("does not call onSubmit when the name is empty (Zod onSubmit validation)", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({ availableTags: [VIP_TAG] });

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits tagIds undefined and memo null when only the name is typed", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		await user.type(screen.getByLabelText("Player name *"), "Solo");
		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledWith({
			memo: null,
			name: "Solo",
			tagIds: undefined,
		});
	});

	it("omits the tags field when availableTags is not provided", () => {
		renderForm({});
		expect(
			screen.queryByLabelText("Search player tags")
		).not.toBeInTheDocument();
	});

	it("prefills the name from defaultValues", () => {
		renderForm({ defaultValues: { name: "Carol" } });
		expect(screen.getByLabelText("Player name *")).toHaveValue("Carol");
	});
});
