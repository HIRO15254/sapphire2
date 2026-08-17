import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

describe("Field", () => {
	it("renders a label and links it to the child input via htmlFor / id", () => {
		render(
			<Field htmlFor="name" label="Name">
				<Input id="name" />
			</Field>
		);
		const label = screen.getByText("Name");
		expect(label.tagName).toBe("LABEL");
		expect(label).toHaveAttribute("for", "name");
		expect(screen.getByLabelText("Name")).toBe(screen.getByRole("textbox"));
	});

	it("appends a red asterisk when required is true", () => {
		render(
			<Field htmlFor="x" label="X" required>
				<Input id="x" />
			</Field>
		);
		const asterisk = screen.getByText("*");
		expect(asterisk).toHaveClass("text-destructive");
	});

	it("omits the asterisk when required is omitted / false", () => {
		render(
			<Field htmlFor="x" label="X">
				<Input id="x" />
			</Field>
		);
		expect(screen.queryByText("*")).not.toBeInTheDocument();
	});

	it("renders nothing for the label when label is omitted", () => {
		const { container } = render(
			<Field>
				<Input />
			</Field>
		);
		expect(container.querySelector("label")).toBeNull();
	});

	it("renders the description when provided", () => {
		render(
			<Field description="Up to 4 characters." label="Unit">
				<Input />
			</Field>
		);
		expect(screen.getByText("Up to 4 characters.")).toBeInTheDocument();
	});

	it("omits the description block when description is omitted", () => {
		const { container } = render(
			<Field label="Unit">
				<Input />
			</Field>
		);
		expect(container.querySelectorAll("p").length).toBe(0);
	});

	it("renders the error message when error is set", () => {
		render(
			<Field error="Required" label="Name">
				<Input />
			</Field>
		);
		const error = screen.getByText("Required");
		expect(error).toBeInTheDocument();
		expect(error).toHaveAttribute("role", "alert");
	});

	it("injects aria-invalid=true onto a single React-element child when error is truthy", () => {
		render(
			<Field error="Required" label="Name">
				<Input data-testid="invalid-input" />
			</Field>
		);
		expect(screen.getByTestId("invalid-input")).toHaveAttribute(
			"aria-invalid",
			"true"
		);
	});

	it("does not inject aria-invalid when error is falsy", () => {
		render(
			<Field label="Name">
				<Input data-testid="ok-input" />
			</Field>
		);
		expect(screen.getByTestId("ok-input")).not.toHaveAttribute("aria-invalid");
	});

	it("does not inject aria-invalid on plain-string children (withInvalid no-ops)", () => {
		const { container } = render(<Field error="bad">plain text</Field>);
		expect(container).toHaveTextContent("plain text");
		expect(container).toHaveTextContent("bad");
	});

	it("does not inject aria-invalid when children is an array of elements (multi-input field handles its own invalid state)", () => {
		render(
			<Field error="x">
				{[<Input data-testid="a" key="a" />, <Input data-testid="b" key="b" />]}
			</Field>
		);
		expect(screen.getByTestId("a")).not.toHaveAttribute("aria-invalid");
		expect(screen.getByTestId("b")).not.toHaveAttribute("aria-invalid");
	});

	it("renders label + description + error together without dropping either", () => {
		render(
			<Field
				description="Up to 4 characters."
				error="Too long"
				htmlFor="u"
				label="Unit"
			>
				<Input id="u" />
			</Field>
		);
		expect(screen.getByText("Unit")).toBeInTheDocument();
		expect(screen.getByText("Up to 4 characters.")).toBeInTheDocument();
		expect(screen.getByText("Too long")).toBeInTheDocument();
	});

	it("forwards arbitrary props (e.g. data-*, className) onto the wrapper div", () => {
		const { container } = render(
			<Field className="custom-cls" data-testid="wrap" label="X">
				<Input />
			</Field>
		);
		const wrap = screen.getByTestId("wrap");
		expect(wrap).toHaveClass("custom-cls");
		expect(container.firstChild).toBe(wrap);
	});
});

it("links a single input to its validation error", () => {
	render(
		<Field error="Required" label="Name">
			<Input data-testid="name" />
		</Field>
	);

	const error = screen.getByRole("alert");
	expect(error).toHaveAttribute("id");
	expect(screen.getByTestId("name")).toHaveAttribute(
		"aria-describedby",
		error.id
	);
});
