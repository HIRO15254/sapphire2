import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQueryClient as render } from "@/__tests__/test-utils";

// RulesStepBody (tournament) transitively imports @/utils/trpc; stub it.
vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: async () => [],
				}),
			},
		},
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: async () => [],
				}),
			},
		},
		gameMix: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameMix", "list"],
					queryFn: async () => [],
				}),
			},
		},
	},
	trpcClient: {
		gameVariant: {
			create: { mutate: vi.fn() },
		},
		blindLevel: {
			listByTournament: { query: vi.fn().mockResolvedValue([]) },
		},
		tournamentChipPurchase: {
			listByTournament: { query: vi.fn().mockResolvedValue([]) },
		},
	},
}));

import { LiveSessionForm } from "@/features/live-sessions/components/create-session-dialog/live-session-form/live-session-form";

const ROOMS = [{ id: "room-1", name: "My Casino" }];
const NEXT_RE = /Next/;
const BACK_RE = /Back/;
const CUSTOMIZE_RE = /Customize rules/;
const BUY_IN_LABEL = /^Initial buy-in/;

function renderForm() {
	return render(
		<LiveSessionForm formId="live-form" onSubmit={vi.fn()} rooms={ROOMS} />
	);
}

describe("LiveSessionForm", () => {
	it("renders a single screen: type tabs, room, initial buy-in, customize rules", () => {
		renderForm();
		expect(screen.getByText("Session type")).toBeInTheDocument();
		expect(screen.getByText("Cash game")).toBeInTheDocument();
		expect(screen.getByText("Tournament")).toBeInTheDocument();
		expect(screen.getByText("Room")).toBeInTheDocument();
		expect(screen.getByText("Initial buy-in")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: CUSTOMIZE_RE })
		).toBeInTheDocument();
	});

	it("has no wizard step navigation (no Back / Next buttons)", () => {
		renderForm();
		expect(
			screen.queryByRole("button", { name: NEXT_RE })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: BACK_RE })
		).not.toBeInTheDocument();
	});

	it("submits the entered buy-in from a toolbar button outside the form", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(
			<>
				<LiveSessionForm formId="live-form" onSubmit={onSubmit} rooms={ROOMS} />
				<button form="live-form" type="submit">
					Start session
				</button>
			</>
		);
		await user.type(screen.getByRole("textbox", { name: BUY_IN_LABEL }), "500");
		await user.click(screen.getByRole("button", { name: "Start session" }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ type: "cash_game", buyIn: 500 })
		);
	});

	it("keeps the rules section collapsed by default", () => {
		renderForm();
		const trigger = screen.getByRole("button", { name: CUSTOMIZE_RE });
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByLabelText("Rule name")).not.toBeInTheDocument();
	});

	it("reveals the rule fields when Customize rules is expanded", async () => {
		const user = userEvent.setup();
		renderForm();
		const trigger = screen.getByRole("button", { name: CUSTOMIZE_RE });
		await user.click(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(await screen.findByLabelText("Rule name")).toBeInTheDocument();
	});
});
