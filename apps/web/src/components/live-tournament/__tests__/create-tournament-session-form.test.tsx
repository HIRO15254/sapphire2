import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
	{ id: "t1", name: "Friday MTT", currencyId: "c2" },
	{ id: "t2", name: "Sunday Special", currencyId: null },
];

describe("CreateTournamentSessionForm", () => {
	it("renders store selector when stores available", () => {
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
		expect(screen.getByText("Start Tournament")).toBeInTheDocument();
	});

	it("hides store selector when no stores", () => {
		render(
			<CreateTournamentSessionForm
				currencies={CURRENCIES}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={[]}
				tournaments={[]}
			/>
		);

		expect(screen.queryByText("Store")).not.toBeInTheDocument();
	});

	it("renders store selector with store options", () => {
		render(
			<CreateTournamentSessionForm
				currencies={CURRENCIES}
				isLoading={false}
				onStoreChange={vi.fn()}
				onSubmit={vi.fn()}
				stores={STORES}
				tournaments={TOURNAMENTS}
			/>
		);

		// Store label should be visible
		expect(screen.getByText("Store")).toBeInTheDocument();
		// Combobox trigger (at least one for store) should be rendered
		const comboboxes = screen.getAllByRole("combobox");
		expect(comboboxes.length).toBeGreaterThanOrEqual(1);
	});

	it("renders currency selector", () => {
		render(
			<CreateTournamentSessionForm
				currencies={CURRENCIES}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={[]}
				tournaments={[]}
			/>
		);

		expect(screen.getByText("Currency")).toBeInTheDocument();
	});

	it("renders memo textarea", () => {
		render(
			<CreateTournamentSessionForm
				currencies={[]}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={[]}
				tournaments={[]}
			/>
		);

		expect(screen.getByText("Memo")).toBeInTheDocument();
		expect(
			screen.getByPlaceholderText("Notes about this tournament")
		).toBeInTheDocument();
	});

	it("submits form with selected values", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<CreateTournamentSessionForm
				currencies={[]}
				isLoading={false}
				onSubmit={onSubmit}
				stores={[]}
				tournaments={[]}
			/>
		);

		await user.click(screen.getByText("Start Tournament"));

		expect(onSubmit).toHaveBeenCalledWith({
			storeId: undefined,
			tournamentId: undefined,
			currencyId: undefined,
			memo: undefined,
		});
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
