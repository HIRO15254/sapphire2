import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The manual branch renders the tournament rule bodies, which transitively
// import @/utils/trpc (env-validating). Stub it so the module tree loads.
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

import { SessionEditForm } from "@/features/sessions/pages/session-detail-page/session-edit-form/session-edit-form";
import type { SessionFormDefaults } from "@/features/sessions/utils/session-form-helpers";

const ROOMS = [{ id: "r1", name: "Aria" }];
const CURRENCIES = [{ id: "c1", name: "USD" }];
const TAGS = [{ id: "t1", name: "Profit" }];

const CASH_DEFAULTS: SessionFormDefaults = {
	type: "cash_game",
	sessionDate: "2026-04-10",
	buyIn: 10_000,
	cashOut: 11_500,
	roomId: "r1",
	currencyId: "c1",
	memo: "good run",
};

function renderForm(
	props: Partial<Parameters<typeof SessionEditForm>[0]> = {}
) {
	return render(
		<SessionEditForm
			currencies={CURRENCIES}
			defaultValues={CASH_DEFAULTS}
			formId="session-edit-form"
			onSubmit={vi.fn()}
			rooms={ROOMS}
			tags={TAGS}
			{...props}
		/>
	);
}

describe("SessionEditForm", () => {
	describe("live-linked session", () => {
		it("renders only room, currency, tags and memo", () => {
			renderForm({ isLiveLinked: true });
			expect(screen.getByText("Room")).toBeInTheDocument();
			expect(screen.getByText("Currency")).toBeInTheDocument();
			expect(screen.getByText("Session tags")).toBeInTheDocument();
			expect(screen.getByText("Memo")).toBeInTheDocument();
		});

		it("does not render the buy-in / cash-out result fields", () => {
			renderForm({ isLiveLinked: true });
			expect(screen.queryByText("Buy-in")).not.toBeInTheDocument();
			expect(screen.queryByText("Cash-out")).not.toBeInTheDocument();
		});

		it("does not render rule fields such as variant or blinds", () => {
			renderForm({ isLiveLinked: true });
			expect(screen.queryByText("Variant")).not.toBeInTheDocument();
			expect(screen.queryByText("Session date")).not.toBeInTheDocument();
		});

		it("renders no wizard navigation buttons", () => {
			renderForm({ isLiveLinked: true });
			expect(
				screen.queryByRole("button", { name: "Next" })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Back" })
			).not.toBeInTheDocument();
		});
	});

	describe("manual session", () => {
		it("renders the result fields for a manual cash session", () => {
			renderForm({ isLiveLinked: false });
			expect(screen.getByText("Buy-in")).toBeInTheDocument();
			expect(screen.getByText("Cash-out")).toBeInTheDocument();
		});

		it("renders the rule fields and date/time for a manual cash session", () => {
			renderForm({ isLiveLinked: false });
			expect(screen.getByText("Variant")).toBeInTheDocument();
			expect(screen.getByText("Session date")).toBeInTheDocument();
		});

		it("renders no wizard navigation buttons", () => {
			renderForm({ isLiveLinked: false });
			expect(
				screen.queryByRole("button", { name: "Next" })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Back" })
			).not.toBeInTheDocument();
		});

		it("wires the form id onto the rendered form element", () => {
			const { container } = renderForm({ isLiveLinked: false });
			expect(container.querySelector("form")).toHaveAttribute(
				"id",
				"session-edit-form"
			);
		});
	});
});
