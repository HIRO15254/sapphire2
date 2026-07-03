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

// Anchored so "Buy-in" does not also match "Min buy-in" / "Max buy-in", and to
// tolerate the trailing " *" that required-field labels append.
const BUY_IN_LABEL = /^Buy-in/;
const CASH_OUT_LABEL = /^Cash-out/;
const SESSION_DATE_LABEL = /^Session date/;

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
	describe("shared structure", () => {
		it("groups the form into Master / Rules / Result sections for both modes", () => {
			for (const isLiveLinked of [false, true]) {
				const { unmount } = renderForm({ isLiveLinked });
				expect(screen.getByText("Master")).toBeInTheDocument();
				expect(screen.getByText("Rules")).toBeInTheDocument();
				expect(screen.getByText("Result")).toBeInTheDocument();
				unmount();
			}
		});

		it("renders the same fields regardless of live-linked state", () => {
			for (const isLiveLinked of [false, true]) {
				const { unmount } = renderForm({ isLiveLinked });
				expect(screen.getByLabelText(BUY_IN_LABEL)).toBeInTheDocument();
				expect(screen.getByLabelText(SESSION_DATE_LABEL)).toBeInTheDocument();
				expect(screen.getByText("Room")).toBeInTheDocument();
				expect(screen.getByText("Currency")).toBeInTheDocument();
				expect(screen.getByText("Session tags")).toBeInTheDocument();
				expect(screen.getByLabelText("Memo")).toBeInTheDocument();
				unmount();
			}
		});

		it("renders no wizard navigation buttons in either mode", () => {
			for (const isLiveLinked of [false, true]) {
				const { unmount } = renderForm({ isLiveLinked });
				expect(
					screen.queryByRole("button", { name: "Next" })
				).not.toBeInTheDocument();
				expect(
					screen.queryByRole("button", { name: "Back" })
				).not.toBeInTheDocument();
				unmount();
			}
		});

		it("wires the form id onto the rendered form element", () => {
			const { container } = renderForm({ isLiveLinked: false });
			expect(container.querySelector("form")).toHaveAttribute(
				"id",
				"session-edit-form"
			);
		});
	});

	describe("live-linked session", () => {
		it("shows the live-linked explanation banner", () => {
			renderForm({ isLiveLinked: true });
			expect(screen.getByTestId("live-linked-banner")).toBeInTheDocument();
		});

		it("disables the event-derived fields (buy-in, cash-out, session date)", () => {
			renderForm({ isLiveLinked: true });
			expect(screen.getByLabelText(BUY_IN_LABEL)).toBeDisabled();
			expect(screen.getByLabelText(CASH_OUT_LABEL)).toBeDisabled();
			expect(screen.getByLabelText(SESSION_DATE_LABEL)).toBeDisabled();
		});

		it("keeps memo editable (a field session.update accepts for live sessions)", () => {
			renderForm({ isLiveLinked: true });
			expect(screen.getByLabelText("Memo")).not.toBeDisabled();
		});
	});

	describe("manual session", () => {
		it("does not show the live-linked banner", () => {
			renderForm({ isLiveLinked: false });
			expect(
				screen.queryByTestId("live-linked-banner")
			).not.toBeInTheDocument();
		});

		it("keeps the result fields editable", () => {
			renderForm({ isLiveLinked: false });
			expect(screen.getByLabelText(BUY_IN_LABEL)).not.toBeDisabled();
			expect(screen.getByLabelText(CASH_OUT_LABEL)).not.toBeDisabled();
			expect(screen.getByLabelText("Memo")).not.toBeDisabled();
		});
	});
});
