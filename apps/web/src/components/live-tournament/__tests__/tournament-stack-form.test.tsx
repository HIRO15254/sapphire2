import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentStackForm } from "../tournament-stack-form";

// Mock the tournament form context
const mockSetStackAmount = vi.fn();
const mockSetRemainingPlayers = vi.fn();
const mockSetAverageStack = vi.fn();
const mockSetRebuy = vi.fn();
const mockSetAddon = vi.fn();

vi.mock("@/routes/active-session", () => ({
	useTournamentFormContext: () => ({
		state: {
			stackAmount: "",
			remainingPlayers: "",
			averageStack: "",
			rebuy: null,
			addon: null,
		},
		setStackAmount: mockSetStackAmount,
		setRemainingPlayers: mockSetRemainingPlayers,
		setAverageStack: mockSetAverageStack,
		setRebuy: mockSetRebuy,
		setAddon: mockSetAddon,
	}),
}));

// Mock ResponsiveDialog to render children without portal
vi.mock("@/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		open,
	}: {
		children: React.ReactNode;
		open: boolean;
	}) => (open ? <div>{children}</div> : null),
}));

describe("TournamentStackForm", () => {
	it("renders stack input and buttons", () => {
		render(
			<TournamentStackForm
				isLoading={false}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByPlaceholderText("Stack")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Remaining")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Avg Stack")).toBeInTheDocument();
		expect(screen.getByText("Update")).toBeInTheDocument();
		expect(screen.getByText("End")).toBeInTheDocument();
		expect(screen.getByText("+ Rebuy")).toBeInTheDocument();
		expect(screen.getByText("+ Addon")).toBeInTheDocument();
	});

	it("shows loading state on Update button", () => {
		render(
			<TournamentStackForm isLoading onComplete={vi.fn()} onSubmit={vi.fn()} />
		);

		expect(screen.getByText("...")).toBeInTheDocument();
	});

	it("calls onComplete when End is clicked", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();

		render(
			<TournamentStackForm
				isLoading={false}
				onComplete={onComplete}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByText("End"));
		expect(onComplete).toHaveBeenCalled();
	});

	it("opens rebuy sheet when +Rebuy clicked", async () => {
		const user = userEvent.setup();

		render(
			<TournamentStackForm
				isLoading={false}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByText("+ Rebuy"));
		// Sheet should open with "Add Rebuy" title
		expect(screen.getByText("Rebuy Cost")).toBeInTheDocument();
		expect(screen.getByText("Chips Received")).toBeInTheDocument();
	});

	it("opens addon sheet when +Addon clicked", async () => {
		const user = userEvent.setup();

		render(
			<TournamentStackForm
				isLoading={false}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByText("+ Addon"));
		expect(screen.getByText("Addon Cost")).toBeInTheDocument();
	});
});
