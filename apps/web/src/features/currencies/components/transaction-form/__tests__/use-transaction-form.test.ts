import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	useTransactionTypes: vi.fn(),
}));

vi.mock("@/features/currencies/hooks/use-transaction-types", () => ({
	useTransactionTypes: hoisted.useTransactionTypes,
}));

import {
	getButtonLabel,
	NEW_TYPE_VALUE,
	useTransactionForm,
} from "@/features/currencies/components/transaction-form/use-transaction-form";

const TYPES = [
	{ id: "t1", name: "Deposit" },
	{ id: "t2", name: "Withdrawal" },
];

const TODAY_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

describe("getButtonLabel", () => {
	it("returns 'Creating type...' when isCreatingType is true regardless of isLoading", () => {
		expect(getButtonLabel(true, false)).toBe("Creating type...");
		expect(getButtonLabel(true, true)).toBe("Creating type...");
	});

	it("returns 'Saving...' when only isLoading", () => {
		expect(getButtonLabel(false, true)).toBe("Saving...");
	});

	it("returns 'Save' when neither flag is set", () => {
		expect(getButtonLabel(false, false)).toBe("Save");
	});
});

describe("useTransactionForm", () => {
	const createType = vi.fn();

	beforeEach(() => {
		createType.mockReset();
		hoisted.useTransactionTypes.mockReturnValue({
			types: TYPES,
			createType,
			isCreatingType: false,
		});
	});

	it("exposes the list of types from useTransactionTypes", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		expect(result.current.types).toEqual(TYPES);
		expect(result.current.isCreatingType).toBe(false);
	});

	it("defaults transactedAt to today's ISO date when no defaults provided", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		expect(result.current.form.state.values.transactedAt).toMatch(
			TODAY_ISO_PATTERN
		);
	});

	it("seeds amount as string and transactedAt from defaultValues", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTransactionForm({
				onSubmit,
				defaultValues: {
					amount: 1500,
					transactionTypeId: "t1",
					transactedAt: "2026-04-01T00:00:00.000Z",
					memo: "note",
				},
			})
		);
		expect(result.current.form.state.values.amount).toBe("1500");
		expect(result.current.form.state.values.memo).toBe("note");
		expect(result.current.form.state.values.transactedAt).toBe("2026-04-01");
		expect(result.current.form.state.values.transactionTypeId).toBe("t1");
	});

	it("rejects submit when amount is missing", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("transactionTypeId", "t1");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects submit when transactionTypeId is empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("amount", "100");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects submit when newTypeName is required but empty (NEW_TYPE_VALUE branch)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("amount", "100");
			result.current.form.setFieldValue("transactionTypeId", NEW_TYPE_VALUE);
			result.current.form.setFieldValue("newTypeName", "   ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
		expect(createType).not.toHaveBeenCalled();
	});

	it("submits with memo omitted when empty and existing type", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("amount", "250");
			result.current.form.setFieldValue("transactionTypeId", "t1");
			result.current.form.setFieldValue("transactedAt", "2026-04-10");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			amount: 250,
			transactionTypeId: "t1",
			transactedAt: "2026-04-10",
			memo: undefined,
		});
	});

	it("creates a new type then submits with the returned id when NEW_TYPE_VALUE and newTypeName non-empty", async () => {
		createType.mockResolvedValue({ id: "t-new", name: "Bonus" });
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("amount", "500");
			result.current.form.setFieldValue("transactionTypeId", NEW_TYPE_VALUE);
			result.current.form.setFieldValue("newTypeName", "  Bonus  ");
			result.current.form.setFieldValue("transactedAt", "2026-04-11");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(createType).toHaveBeenCalledWith("Bonus");
		expect(onSubmit).toHaveBeenCalledWith({
			amount: 500,
			transactionTypeId: "t-new",
			transactedAt: "2026-04-11",
			memo: undefined,
		});
	});
});
