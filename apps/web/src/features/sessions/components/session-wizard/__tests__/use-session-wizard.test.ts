import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Tournament rules step transitively imports @/utils/trpc; stub it so the
// env-validating import chain never loads under jsdom.
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

import { useSessionWizard } from "@/features/sessions/components/session-wizard/use-session-wizard";

function renderLiveWizard(onSubmit = vi.fn()) {
	return renderHook(() =>
		useSessionWizard({
			mode: "live",
			onSubmit,
		})
	);
}

describe("useSessionWizard — handleFormSubmit — live cash buyIn validation", () => {
	it("does not call onSubmit when buyIn is empty on the Start step in live cash mode", () => {
		const onSubmit = vi.fn();
		const { result } = renderLiveWizard(onSubmit);

		// Advance to the start step (last step in live mode): master → rules → start
		act(() => result.current.goToNext());
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("start");
		expect(result.current.isCashGame).toBe(true);
		expect(result.current.form.getFieldValue("buyIn")).toBe("");

		// Submit with empty buyIn
		act(() => {
			result.current.handleFormSubmit();
		});

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("sets Required error on buyIn when empty on the Start step in live cash mode", async () => {
		const { result } = renderLiveWizard();

		act(() => result.current.goToNext());
		act(() => result.current.goToNext());

		act(() => {
			result.current.handleFormSubmit();
		});

		await waitFor(() => {
			const errors = result.current.form.state.fieldMeta.buyIn?.errors ?? [];
			expect(errors).toHaveLength(1);
			expect((errors[0] as { message: string })?.message).toBe("Required");
		});
	});

	it("calls onSubmit when buyIn is non-empty on the Start step in live cash mode", async () => {
		const onSubmit = vi.fn();
		const { result } = renderLiveWizard(onSubmit);

		act(() => result.current.goToNext());
		act(() => result.current.goToNext());

		act(() => {
			result.current.form.setFieldValue("buyIn", "5000");
		});

		act(() => {
			result.current.handleFormSubmit();
		});

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ type: "cash_game", buyIn: 5000 })
		);
	});

	it("clears the Required error on the next submit when buyIn is filled", async () => {
		const onSubmit = vi.fn();
		const { result } = renderLiveWizard(onSubmit);

		act(() => result.current.goToNext());
		act(() => result.current.goToNext());

		// First submit — sets error
		act(() => {
			result.current.handleFormSubmit();
		});
		await waitFor(() => {
			const errors = result.current.form.state.fieldMeta.buyIn?.errors ?? [];
			expect(errors).toHaveLength(1);
		});

		// Fill buyIn and submit again
		act(() => {
			result.current.form.setFieldValue("buyIn", "1000");
		});
		act(() => {
			result.current.handleFormSubmit();
		});

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		const errors = result.current.form.state.fieldMeta.buyIn?.errors ?? [];
		expect(errors).toHaveLength(0);
	});
});

describe("useSessionWizard — handleFormSubmit — live tournament (no buyIn guard)", () => {
	it("calls onSubmit even with empty buyIn in live tournament mode on the Start step", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "live", onSubmit })
		);

		// Switch to tournament
		act(() => result.current.setSessionType("tournament"));

		// Advance to start step
		act(() => result.current.goToNext());
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("start");
		expect(result.current.isCashGame).toBe(false);

		act(() => {
			result.current.handleFormSubmit();
		});

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ type: "tournament" })
		);
	});
});

describe("useSessionWizard — handleFormSubmit — manual mode (no buyIn guard)", () => {
	it("calls onSubmit with empty buyIn in manual cash mode (guard applies to live only)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "manual", onSubmit })
		);

		// Advance to the result step (last step in manual mode): master → rules → result
		act(() => result.current.goToNext());
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("result");
		expect(result.current.isCashGame).toBe(true);

		act(() => {
			result.current.handleFormSubmit();
		});

		// Manual mode does not guard buyIn — onSubmit fires
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ type: "cash_game" })
		);
	});
});

describe("useSessionWizard — handleFormSubmit — not on start step", () => {
	it("does not apply buyIn guard when not on the start step (e.g., Enter on Master step)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderLiveWizard(onSubmit);

		// Stay on master step (first step)
		expect(result.current.currentStep).toBe("master");

		// Pressing Enter on master step triggers handleFormSubmit but guard
		// doesn't apply — the form is not yet on the start step.
		act(() => {
			result.current.handleFormSubmit();
		});

		// Guard skipped — form.handleSubmit runs. schema validates OK (sessionDate
		// is present via default), onSubmit is called.
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
	});
});
