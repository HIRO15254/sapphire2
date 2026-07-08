import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GameVariantForm } from "./game-variant-form";

const FORM_ID = "game-variant-form-test";
const SAVE_RE = /save/i;

// The form renders no submit button of its own — the surrounding FormSheet
// owns Save and submits via the `form` attribute. Mirror that with an
// external button so the test exercises the `id={formId}` wiring.
function renderForm(
	props: Partial<React.ComponentProps<typeof GameVariantForm>>
) {
	const onSubmit = props.onSubmit ?? vi.fn();
	render(
		<>
			<GameVariantForm formId={FORM_ID} onSubmit={onSubmit} {...props} />
			<button form={FORM_ID} type="submit">
				submit-trigger
			</button>
		</>
	);
	return { onSubmit };
}

describe("GameVariantForm", () => {
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
		expect(
			screen.getByRole("button", { name: "submit-trigger" })
		).toBeInTheDocument();
	});

	it("submits the name with blind labels null when only the name is typed", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		await user.type(screen.getByLabelText("Name *"), "PLO5");
		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			name: "PLO5",
			blindLabel1: null,
			blindLabel2: null,
			blindLabel3: null,
		});
	});

	it("submits typed blind labels alongside the name", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		await user.type(screen.getByLabelText("Name *"), "NLH");
		await user.type(screen.getByLabelText("Blind label 1"), "SB");
		await user.type(screen.getByLabelText("Blind label 2"), "BB");
		await user.type(screen.getByLabelText("Blind label 3"), "Straddle");
		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledWith({
			name: "NLH",
			blindLabel1: "SB",
			blindLabel2: "BB",
			blindLabel3: "Straddle",
		});
	});

	it("does not call onSubmit when the name is empty (Zod onSubmit validation)", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("prefills the name and blind labels from defaultValues", () => {
		renderForm({
			defaultValues: {
				name: "Short Deck",
				blindLabel1: "Button blind",
				blindLabel2: null,
				blindLabel3: null,
			},
		});
		expect(screen.getByLabelText("Name *")).toHaveValue("Short Deck");
		expect(screen.getByLabelText("Blind label 1")).toHaveValue("Button blind");
		expect(screen.getByLabelText("Blind label 2")).toHaveValue("");
		expect(screen.getByLabelText("Blind label 3")).toHaveValue("");
	});

	it("renders no placeholder text on the name input", () => {
		renderForm({});
		expect(screen.getByLabelText("Name *")).not.toHaveAttribute("placeholder");
	});
});
