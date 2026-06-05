import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeSetting } from "./theme-setting";

const mocks = vi.hoisted(() => ({
	setTheme: vi.fn(),
	theme: "dark" as string | undefined,
}));

vi.mock("next-themes", () => ({
	useTheme: () => ({
		setTheme: mocks.setTheme,
		theme: mocks.theme,
	}),
}));

describe("ThemeSetting", () => {
	it("renders Light, Dark, and System radio options", () => {
		render(<ThemeSetting />);

		expect(screen.getByRole("radio", { name: "Light" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "Dark" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "System" })).toBeInTheDocument();
	});

	it("has aria-label='Theme' on the radio group", () => {
		render(<ThemeSetting />);

		expect(
			screen.getByRole("radiogroup", { name: "Theme" })
		).toBeInTheDocument();
	});

	it("marks the current theme option as checked and others as unchecked", () => {
		mocks.theme = "dark";
		render(<ThemeSetting />);

		expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked();
		expect(screen.getByRole("radio", { name: "System" })).not.toBeChecked();
	});

	it("calls setTheme with the selected value when a different option is clicked", async () => {
		mocks.theme = "dark";
		mocks.setTheme.mockClear();
		const user = userEvent.setup();

		render(<ThemeSetting />);

		await user.click(screen.getByRole("radio", { name: "Light" }));
		expect(mocks.setTheme).toHaveBeenCalledTimes(1);
		expect(mocks.setTheme).toHaveBeenCalledWith("light");
	});

	it("does not call setTheme when the currently selected option is clicked (RadioGroup semantics)", async () => {
		mocks.theme = "dark";
		mocks.setTheme.mockClear();
		const user = userEvent.setup();

		render(<ThemeSetting />);

		await user.click(screen.getByRole("radio", { name: "Dark" }));
		expect(mocks.setTheme).not.toHaveBeenCalled();
	});

	it("calls setTheme with 'system' when System is clicked", async () => {
		mocks.theme = "dark";
		mocks.setTheme.mockClear();
		const user = userEvent.setup();

		render(<ThemeSetting />);

		await user.click(screen.getByRole("radio", { name: "System" }));
		expect(mocks.setTheme).toHaveBeenCalledTimes(1);
		expect(mocks.setTheme).toHaveBeenCalledWith("system");
	});
});
