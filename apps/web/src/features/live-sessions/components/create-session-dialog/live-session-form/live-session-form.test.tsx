import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// RulesStepBody (tournament) transitively imports @/utils/trpc; stub it.
vi.mock("@/utils/trpc", () => ({
	trpc: {},
	trpcClient: {
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

	it("carries the provided form id so the FormSheet toolbar can submit it", () => {
		const { container } = renderForm();
		expect(container.querySelector("form#live-form")).not.toBeNull();
	});

	it("auto-expands the rules section when no master is selected", () => {
		renderForm();
		const trigger = screen.getByRole("button", { name: CUSTOMIZE_RE });
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByLabelText("Rule name")).toBeInTheDocument();
	});

	it("collapses the rules section when Customize rules is toggled off", async () => {
		const user = userEvent.setup();
		renderForm();
		const trigger = screen.getByRole("button", { name: CUSTOMIZE_RE });
		await user.click(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});
});
