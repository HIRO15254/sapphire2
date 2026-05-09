import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCompleteSessionForm } from "@/features/live-sessions/components/complete-session-form/use-complete-session-form";

describe("useCompleteSessionForm — cash_game", () => {
	it("seeds finalStack with empty string when defaultFinalStack is undefined", () => {
		const { result } = renderHook(() =>
			useCompleteSessionForm({ kind: "cash_game", onSubmit: vi.fn() })
		);
		expect(result.current.cashForm.state.values.finalStack).toBe("");
	});

	it("seeds finalStack from defaultFinalStack prop", () => {
		const { result } = renderHook(() =>
			useCompleteSessionForm({
				kind: "cash_game",
				onSubmit: vi.fn(),
				defaultFinalStack: 500,
			})
		);
		expect(result.current.cashForm.state.values.finalStack).toBe("500");
	});

	it("rejects empty finalStack on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCompleteSessionForm({ kind: "cash_game", onSubmit })
		);
		await act(async () => {
			await result.current.cashForm.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects negative finalStack on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCompleteSessionForm({ kind: "cash_game", onSubmit })
		);
		act(() => result.current.cashForm.setFieldValue("finalStack", "-10"));
		await act(async () => {
			await result.current.cashForm.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("calls onSubmit with { kind: 'cash_game', finalStack } on valid input", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCompleteSessionForm({ kind: "cash_game", onSubmit })
		);
		act(() => result.current.cashForm.setFieldValue("finalStack", "1500"));
		await act(async () => {
			await result.current.cashForm.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			kind: "cash_game",
			finalStack: 1500,
		});
	});
});

describe("useCompleteSessionForm — tournament", () => {
	it("initialises tournament form defaults", () => {
		const { result } = renderHook(() =>
			useCompleteSessionForm({ kind: "tournament", onSubmit: vi.fn() })
		);
		expect(result.current.tournamentForm.state.values.beforeDeadline).toBe(
			false
		);
		expect(result.current.tournamentForm.state.values.placement).toBe("");
		expect(result.current.tournamentForm.state.values.totalEntries).toBe("");
		expect(result.current.tournamentForm.state.values.prizeMoney).toBe("0");
		expect(result.current.tournamentForm.state.values.bountyPrizes).toBe("");
	});

	it("rejects when placement is empty and beforeDeadline is false", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCompleteSessionForm({ kind: "tournament", onSubmit })
		);
		await act(async () => {
			await result.current.tournamentForm.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("calls onSubmit with beforeDeadline=false payload when all fields valid", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCompleteSessionForm({ kind: "tournament", onSubmit })
		);
		act(() => {
			result.current.tournamentForm.setFieldValue("placement", "3");
			result.current.tournamentForm.setFieldValue("totalEntries", "50");
			result.current.tournamentForm.setFieldValue("prizeMoney", "1000");
			result.current.tournamentForm.setFieldValue("bountyPrizes", "100");
		});
		await act(async () => {
			await result.current.tournamentForm.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			kind: "tournament",
			beforeDeadline: false,
			placement: 3,
			totalEntries: 50,
			prizeMoney: 1000,
			bountyPrizes: 100,
		});
	});

	it("calls onSubmit with beforeDeadline=true omitting placement and totalEntries", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCompleteSessionForm({ kind: "tournament", onSubmit })
		);
		act(() => {
			result.current.tournamentForm.setFieldValue("beforeDeadline", true);
			result.current.tournamentForm.setFieldValue("prizeMoney", "200");
		});
		await act(async () => {
			await result.current.tournamentForm.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			kind: "tournament",
			beforeDeadline: true,
			prizeMoney: 200,
			bountyPrizes: 0,
		});
	});

	it("defaults bountyPrizes to 0 when empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCompleteSessionForm({ kind: "tournament", onSubmit })
		);
		act(() => {
			result.current.tournamentForm.setFieldValue("beforeDeadline", true);
			result.current.tournamentForm.setFieldValue("prizeMoney", "500");
			result.current.tournamentForm.setFieldValue("bountyPrizes", "");
		});
		await act(async () => {
			await result.current.tournamentForm.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ bountyPrizes: 0 })
		);
	});
});
