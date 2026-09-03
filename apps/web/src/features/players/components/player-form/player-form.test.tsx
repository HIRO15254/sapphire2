import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerForm } from "./player-form";

const VIP_TAG = { color: "blue", id: "vip", name: "VIP" };
const FORM_ID = "player-form-test";
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

function renderForm(props: Partial<React.ComponentProps<typeof PlayerForm>>) {
	const onSubmit = props.onSubmit ?? vi.fn();
	render(
		<>
			<PlayerForm formId={FORM_ID} onSubmit={onSubmit} {...props} />
			<button form={FORM_ID} type="submit">
				submit-trigger
			</button>
		</>
	);
	return { onSubmit };
}

describe("PlayerForm", () => {
	it("exposes the form by formId without a submit button of its own", () => {
		renderForm({});
		expect(document.getElementById(FORM_ID)?.tagName).toBe("FORM");
		expect(
			screen.queryByRole("button", { name: SAVE_RE })
		).not.toBeInTheDocument();
	});

	it("marks Player name as the only required field", () => {
		renderForm({ availableTags: [VIP_TAG] });
		expect(screen.getAllByText("*")).toHaveLength(1);
		expect(screen.getByLabelText("Player name *")).toBeInTheDocument();
	});

	it("shows the required error under the name field after an empty submit", async () => {
		const user = userEvent.setup();
		renderForm({});
		await user.click(screen.getByRole("button", { name: "submit-trigger" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Name is required"
		);
		expect(screen.getByLabelText("Player name *")).toHaveAttribute(
			"aria-invalid",
			"true"
		);
	});

	it("submits the typed name, memo, and selected tag through the external Save button once", async () => {
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
