import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CurrencyDescription } from "@/features/currencies/v2/components/currency-description";
import { DESCRIPTION_COLLAPSED_MAX_PX } from "@/features/currencies/v2/components/currency-description/use-currency-description";

// jsdom reports scrollHeight as 0; override it so the overflow measurement in
// the hook can be driven deterministically per test.
let mockScrollHeight = 0;
let originalDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
	originalDescriptor = Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		"scrollHeight"
	);
	Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
		configurable: true,
		get() {
			return mockScrollHeight;
		},
	});
});

afterEach(() => {
	if (originalDescriptor) {
		Object.defineProperty(
			HTMLElement.prototype,
			"scrollHeight",
			originalDescriptor
		);
	}
});

const SHORT = DESCRIPTION_COLLAPSED_MAX_PX - 60;
const TALL = DESCRIPTION_COLLAPSED_MAX_PX + 200;
const SHOW_MORE_RE = /show more/i;
const SHOW_LESS_RE = /show less/i;

describe("CurrencyDescription", () => {
	it("renders the Description heading and the rich-text content", () => {
		mockScrollHeight = SHORT;
		render(<CurrencyDescription html="<p>Hello notes</p>" />);
		expect(
			screen.getByRole("heading", { name: "Description" })
		).toBeInTheDocument();
		expect(screen.getByText("Hello notes")).toBeInTheDocument();
	});

	it("does not render a toggle when the content fits within the collapsed height", () => {
		mockScrollHeight = SHORT;
		render(<CurrencyDescription html="<p>short</p>" />);
		expect(
			screen.queryByRole("button", { name: SHOW_MORE_RE })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: SHOW_LESS_RE })
		).not.toBeInTheDocument();
	});

	it("clamps the body to the collapsed max height by default", () => {
		mockScrollHeight = TALL;
		render(<CurrencyDescription html="<p>long</p>" />);
		expect(screen.getByTestId("currency-description-body")).toHaveStyle({
			maxHeight: `${DESCRIPTION_COLLAPSED_MAX_PX}px`,
		});
	});

	it("shows a 'Show more' toggle when the content overflows", () => {
		mockScrollHeight = TALL;
		render(<CurrencyDescription html="<p>long</p>" />);
		expect(
			screen.getByRole("button", { name: SHOW_MORE_RE })
		).toBeInTheDocument();
	});

	it("expands the body and swaps the toggle label when 'Show more' is clicked", async () => {
		const user = userEvent.setup();
		mockScrollHeight = TALL;
		render(<CurrencyDescription html="<p>long</p>" />);

		await user.click(screen.getByRole("button", { name: SHOW_MORE_RE }));

		expect(
			screen.getByRole("button", { name: SHOW_LESS_RE })
		).toBeInTheDocument();
		const body = screen.getByTestId("currency-description-body");
		expect(body.style.maxHeight).toBe("");
	});

	it("collapses again when 'Show less' is clicked", async () => {
		const user = userEvent.setup();
		mockScrollHeight = TALL;
		render(<CurrencyDescription html="<p>long</p>" />);

		await user.click(screen.getByRole("button", { name: SHOW_MORE_RE }));
		await user.click(screen.getByRole("button", { name: SHOW_LESS_RE }));

		expect(
			screen.getByRole("button", { name: SHOW_MORE_RE })
		).toBeInTheDocument();
		expect(screen.getByTestId("currency-description-body")).toHaveStyle({
			maxHeight: `${DESCRIPTION_COLLAPSED_MAX_PX}px`,
		});
	});
});
