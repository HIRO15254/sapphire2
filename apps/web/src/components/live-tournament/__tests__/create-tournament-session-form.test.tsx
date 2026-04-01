import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateTournamentSessionForm } from "../create-tournament-session-form";

const STARTING_STACK_RE = /Starting Stack/;

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

		expect(screen.getByText("Store")).toBeInTheDocument();
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

	it("renders starting stack field as required", () => {
		render(
			<CreateTournamentSessionForm
				currencies={[]}
				isLoading={false}
				onSubmit={vi.fn()}
				stores={[]}
				tournaments={[]}
			/>
		);

		expect(screen.getByText("Starting Stack")).toBeInTheDocument();
		const input = screen.getByLabelText(STARTING_STACK_RE);
		expect(input).toBeRequired();
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

	it("submits form with starting stack", async () => {
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

		await user.type(screen.getByLabelText(STARTING_STACK_RE), "15000");
		await user.click(screen.getByText("Start Tournament"));

		expect(onSubmit).toHaveBeenCalledWith({
			storeId: undefined,
			tournamentId: undefined,
			currencyId: undefined,
			startingStack: 15_000,
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
