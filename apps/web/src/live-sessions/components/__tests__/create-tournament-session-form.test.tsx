import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateTournamentSessionForm } from "../create-tournament-session-form";

const STORES = [
	{ id: "s1", name: "Store A" },
	{ id: "s2", name: "Store B" },
];

const CURRENCIES = [
	{ id: "c1", name: "USD" },
	{ id: "c2", name: "JPY" },
];

const TOURNAMENTS = [
	{
		id: "t1",
		name: "Friday MTT",
		buyIn: 10_000,
		entryFee: 1000,
		startingStack: 20_000,
		currencyId: "c2",
	},
	{
		id: "t2",
		name: "Sunday Special",
		buyIn: null,
		entryFee: null,
		startingStack: null,
		currencyId: null,
	},
];

describe("CreateTournamentSessionForm", () => {
	it("renders store selector as required", () => {
		render(
			<CreateTournamentSessionForm
				currencies={CURRENCIES}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={STORES}
				tournaments={[]}
			/>
		);

		expect(screen.getByText("Store")).toBeInTheDocument();
		// Submit button should be disabled until store and tournament selected
		expect(screen.getByText("Start Tournament")).toBeDisabled();
	});

	it("shows message when no stores available", () => {
		render(
			<CreateTournamentSessionForm
				currencies={CURRENCIES}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={[]}
				tournaments={[]}
			/>
		);

		expect(screen.getByText("No stores available")).toBeInTheDocument();
		expect(screen.getByText("Create a store first.")).toBeInTheDocument();
	});

	it("hides buy-in and starting stack until tournament selected", () => {
		render(
			<CreateTournamentSessionForm
				currencies={CURRENCIES}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={STORES}
				tournaments={TOURNAMENTS}
			/>
		);

		// Fields should not be visible before selection
		expect(screen.queryByText("Buy-in")).not.toBeInTheDocument();
		expect(screen.queryByText("Starting Stack")).not.toBeInTheDocument();
		expect(screen.queryByText("Memo")).not.toBeInTheDocument();
	});

	it("shows loading state when isLoading", () => {
		render(
			<CreateTournamentSessionForm
				currencies={[]}
				isLoading
				onSubmit={vi.fn()}
				stores={[]}
				tournaments={[]}
			/>
		);

		expect(screen.getByText("Starting...")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Starting..." })).toBeDisabled();
	});

	it("submit button is disabled when no store/tournament selected", () => {
		render(
			<CreateTournamentSessionForm
				currencies={[]}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={STORES}
				tournaments={[]}
			/>
		);

		expect(screen.getByText("Start Tournament")).toBeDisabled();
	});
});
