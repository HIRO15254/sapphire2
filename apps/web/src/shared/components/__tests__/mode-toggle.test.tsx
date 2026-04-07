import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModeToggle } from "../mode-toggle";

const mocks = vi.hoisted(() => ({
	setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
	useTheme: () => ({
		setTheme: mocks.setTheme,
	}),
}));

vi.mock("@/shared/components/ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
		children,
	DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuItem: ({
		children,
		onClick,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
	}) => (
		<button onClick={onClick} type="button">
			{children}
		</button>
	),
}));

describe("ModeToggle", () => {
	it("renders the theme trigger", () => {
		render(<ModeToggle />);

		expect(
			screen.getByRole("button", { name: "Toggle theme" })
		).toBeInTheDocument();
	});

	it("shows theme options and calls setTheme", async () => {
		const user = userEvent.setup();

		render(<ModeToggle />);

		await user.click(screen.getByRole("button", { name: "Toggle theme" }));
		await user.click(screen.getByText("Dark"));

		expect(screen.getByText("Light")).toBeInTheDocument();
		expect(screen.getByText("System")).toBeInTheDocument();
		expect(mocks.setTheme).toHaveBeenCalledWith("dark");
	});
});
