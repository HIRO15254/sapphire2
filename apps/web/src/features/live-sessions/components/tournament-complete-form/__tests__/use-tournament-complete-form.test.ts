import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTournamentCompleteForm } from "@/features/live-sessions/components/tournament-complete-form/use-tournament-complete-form";

describe("useTournamentCompleteForm", () => {
	it("initialises with beforeDeadline=false and empty placement/totalEntries", () => {
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit: vi.fn() })
		);
		expect(result.current.form.state.values).toEqual({
			beforeDeadline: false,
			placement: "",
			totalEntries: "",
			prizeMoney: "0",
			bountyPrizes: "",
			promote: false,
			bagStack: "",
		});
	});

	it("prefills bagStack from defaultBagStack", () => {
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit: vi.fn(), defaultBagStack: 120_000 })
		);
		expect(result.current.form.state.values.bagStack).toBe("120000");
	});

	it("submits a promote payload with bagStack when promote=true", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit, canPromote: true })
		);
		act(() => {
			result.current.form.setFieldValue("promote", true);
			result.current.form.setFieldValue("bagStack", "85000");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			result: "promoted",
			bagStack: 85_000,
		});
	});

	it("ignores finish-field validation in promote mode (empty placement ok)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit, canPromote: true })
		);
		act(() => {
			result.current.form.setFieldValue("promote", true);
			result.current.form.setFieldValue("bagStack", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ result: "promoted", bagStack: 0 });
	});

	it("rejects a promote submission with an empty bagStack", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit, canPromote: true })
		);
		act(() => {
			result.current.form.setFieldValue("promote", true);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects submission when beforeDeadline=false and placement is empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("totalEntries", "50");
			result.current.form.setFieldValue("prizeMoney", "1000");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects submission when beforeDeadline=false and placement<1", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("placement", "0");
			result.current.form.setFieldValue("totalEntries", "50");
			result.current.form.setFieldValue("prizeMoney", "1000");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits full finished-tournament payload when beforeDeadline=false", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("placement", "3");
			result.current.form.setFieldValue("totalEntries", "50");
			result.current.form.setFieldValue("prizeMoney", "500");
			result.current.form.setFieldValue("bountyPrizes", "25");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			beforeDeadline: false,
			placement: 3,
			totalEntries: 50,
			prizeMoney: 500,
			bountyPrizes: 25,
		});
	});

	it("submits beforeDeadline=true branch without placement/totalEntries even if empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("beforeDeadline", true);
			result.current.form.setFieldValue("prizeMoney", "200");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			beforeDeadline: true,
			prizeMoney: 200,
			bountyPrizes: 0,
		});
	});

	it("treats empty bountyPrizes as 0 in either branch", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentCompleteForm({ onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("beforeDeadline", true);
			result.current.form.setFieldValue("prizeMoney", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenLastCalledWith(
			expect.objectContaining({ bountyPrizes: 0 })
		);
	});
});
