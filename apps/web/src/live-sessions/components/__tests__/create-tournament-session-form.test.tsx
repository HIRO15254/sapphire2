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
	it("renders store selector without requiring selection", () => {
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
		expect(screen.getByText("未指定のまま開始できます")).toBeInTheDocument();
	});

	it("shows guidance message when no stores available", () => {
		render(
			<CreateTournamentSessionForm
				currencies={CURRENCIES}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={[]}
				tournaments={[]}
			/>
		);

		expect(
			screen.getByText("店舗がまだありません。未指定のまま開始できます。")
		).toBeInTheDocument();
	});

	it("shows buy-in and starting stack fields even without a tournament", () => {
		render(
			<CreateTournamentSessionForm
				currencies={CURRENCIES}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={STORES}
				tournaments={TOURNAMENTS}
			/>
		);

		expect(screen.getByText("Buy-in")).toBeInTheDocument();
		expect(screen.getByText("Starting Stack")).toBeInTheDocument();
		expect(screen.getByText("Memo")).toBeInTheDocument();
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
});
