import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameGroupCreate: vi.fn(),
	gameGroupUpdate: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameGroup: {
			list: { queryOptions: () => ({ queryKey: ["gameGroup", "list"] }) },
		},
		gameVariant: {
			list: { queryOptions: () => ({ queryKey: ["gameVariant", "list"] }) },
		},
	},
	trpcClient: {
		gameGroup: {
			create: { mutate: trpcMocks.gameGroupCreate },
			update: { mutate: trpcMocks.gameGroupUpdate },
		},
	},
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { useGroupFormSheet } from "../use-group-form-sheet";

function groupRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "g-1",
		builtinKey: "nlh",
		label: "No Limit Hold'em",
		blind1Label: "Small blind",
		blind2Label: "Big blind",
		blind3Label: null,
		...overrides,
	};
}

describe("useGroupFormSheet", () => {
	beforeEach(() => {
		trpcMocks.gameGroupCreate.mockReset();
		trpcMocks.gameGroupUpdate.mockReset();
		toastMock.error.mockReset();
	});

	it("starts blank in create mode", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: null, onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.formTitle).toBe("Add game group");
		expect(result.current.form.state.values).toEqual({
			label: "",
			blind1Label: "",
			blind2Label: "",
			blind3Label: "",
		});
	});

	it("seeds from the editing group's fields, defaulting a null slot label to blank", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: groupRow(), onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.formTitle).toBe("Edit game group");
		expect(result.current.form.state.values).toEqual({
			label: "No Limit Hold'em",
			blind1Label: "Small blind",
			blind2Label: "Big blind",
			blind3Label: "",
		});
	});

	it("submits a create with trimmed values, blank optionals as null", async () => {
		trpcMocks.gameGroupCreate.mockResolvedValue(groupRow({ id: "g-2" }));
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: null, onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", " Short Deck ");
			result.current.form.setFieldValue("blind1Label", " Ante ");
			result.current.form.setFieldValue("blind2Label", "  ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameGroupCreate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameGroupCreate).toHaveBeenNthCalledWith(1, {
			label: "Short Deck",
			blind1Label: "Ante",
			blind2Label: null,
			blind3Label: null,
		});
	});

	it("resets the form and closes the sheet on create success", async () => {
		trpcMocks.gameGroupCreate.mockResolvedValue(groupRow({ id: "g-2" }));
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: null, onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "Short Deck");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(result.current.form.state.values.label).toBe("");
	});

	it("invalidates both the group and variant lists after a create", async () => {
		trpcMocks.gameGroupCreate.mockResolvedValue(groupRow({ id: "g-2" }));
		const onOpenChange = vi.fn();
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: null, onOpenChange }),
			{ wrapper: withQueryClient(queryClient) }
		);
		act(() => {
			result.current.form.setFieldValue("label", "Short Deck");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ["gameGroup", "list"],
			});
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
	});

	it("submits an edit as an update with trimmed values", async () => {
		trpcMocks.gameGroupUpdate.mockResolvedValue(groupRow());
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: groupRow(), onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", " Hold'em Variants ");
			result.current.form.setFieldValue("blind3Label", " Straddle ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameGroupUpdate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameGroupUpdate).toHaveBeenNthCalledWith(1, {
			id: "g-1",
			label: "Hold'em Variants",
			blind1Label: "Small blind",
			blind2Label: "Big blind",
			blind3Label: "Straddle",
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("keeps the sheet open and toasts on create failure", async () => {
		trpcMocks.gameGroupCreate.mockRejectedValue(new Error("CONFLICT"));
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: null, onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "Short Deck");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(toastMock.error).toHaveBeenNthCalledWith(
			1,
			"Failed to create game group"
		);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("keeps the sheet open and toasts on update failure", async () => {
		trpcMocks.gameGroupUpdate.mockRejectedValue(new Error("CONFLICT"));
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: groupRow(), onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(toastMock.error).toHaveBeenNthCalledWith(
			1,
			"Failed to update game group"
		);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("blocks a create submit with a blank label", async () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: null, onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "   ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameGroupCreate).not.toHaveBeenCalled();
	});

	it("blocks an edit submit with a blank label", async () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: groupRow(), onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "   ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameGroupUpdate).not.toHaveBeenCalled();
	});

	it("resets the form and forwards the close through onOpenChange", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: null, onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "Draft");
		});
		act(() => {
			result.current.onOpenChange(false);
		});
		expect(result.current.form.state.values.label).toBe("");
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("does not reset the form when onOpenChange is called with true", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() => useGroupFormSheet({ editingGroup: null, onOpenChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "Draft");
		});
		act(() => {
			result.current.onOpenChange(true);
		});
		expect(result.current.form.state.values.label).toBe("Draft");
		expect(onOpenChange).toHaveBeenCalledWith(true);
	});
});
