import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameVariantCreate: vi.fn(),
	gameVariantUpdate: vi.fn(),
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
		gameMix: {
			list: { queryOptions: () => ({ queryKey: ["gameMix", "list"] }) },
		},
	},
	trpcClient: {
		gameVariant: {
			create: { mutate: trpcMocks.gameVariantCreate },
			update: { mutate: trpcMocks.gameVariantUpdate },
		},
	},
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { useVariantFormSheet } from "../use-variant-form-sheet";

const GROUPS = [
	{ id: "g-1", label: "No Limit Hold'em" },
	{ id: "g-2", label: "Stud" },
];

function variantRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "v-1",
		builtinKey: null,
		label: "Big Duck",
		shortLabel: "BD",
		groupId: "g-1",
		sortOrder: 0,
		...overrides,
	};
}

describe("useVariantFormSheet", () => {
	beforeEach(() => {
		trpcMocks.gameVariantCreate.mockReset();
		trpcMocks.gameVariantUpdate.mockReset();
		toastMock.error.mockReset();
	});

	it("starts blank except the preselected group in create mode", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: "g-2",
					editingVariant: null,
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.formTitle).toBe("Add game variant");
		expect(result.current.form.state.values).toEqual({
			label: "",
			shortLabel: "",
			groupId: "g-2",
		});
	});

	it("starts with a blank group when no group is preselected", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: null,
					editingVariant: null,
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.form.state.values.groupId).toBe("");
	});

	it("seeds from the editing variant's fields", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: null,
					editingVariant: variantRow(),
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.formTitle).toBe("Edit game variant");
		expect(result.current.form.state.values).toEqual({
			label: "Big Duck",
			shortLabel: "BD",
			groupId: "g-1",
		});
	});

	it("seeds a blank short label when the variant has none", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: null,
					editingVariant: variantRow({ shortLabel: null }),
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.form.state.values.shortLabel).toBe("");
	});

	it("exposes the groups passed in for the select", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: null,
					editingVariant: null,
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.groups).toEqual(GROUPS);
	});

	it("submits a create with the preselected groupId and trimmed values", async () => {
		trpcMocks.gameVariantCreate.mockResolvedValue(variantRow({ id: "v-2" }));
		const onOpenChange = vi.fn();
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: "g-2",
					editingVariant: null,
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient(queryClient) }
		);
		act(() => {
			result.current.form.setFieldValue("label", " Razz ");
			result.current.form.setFieldValue("shortLabel", "  ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameVariantCreate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameVariantCreate).toHaveBeenNthCalledWith(1, {
			label: "Razz",
			shortLabel: null,
			groupId: "g-2",
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(result.current.form.state.values.label).toBe("");
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameGroup", "list"],
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameMix", "list"],
		});
	});

	it("blocks a create submit with no group selected", async () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: null,
					editingVariant: null,
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "Razz");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameVariantCreate).not.toHaveBeenCalled();
	});

	it("blocks a submit with a blank label", async () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: "g-1",
					editingVariant: null,
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "   ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameVariantCreate).not.toHaveBeenCalled();
	});

	it("submits an edit as an update with trimmed values", async () => {
		trpcMocks.gameVariantUpdate.mockResolvedValue(variantRow());
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: null,
					editingVariant: variantRow(),
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", " Big Duck NL ");
			result.current.form.setFieldValue("shortLabel", "  ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameVariantUpdate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameVariantUpdate).toHaveBeenNthCalledWith(1, {
			id: "v-1",
			label: "Big Duck NL",
			shortLabel: null,
			groupId: "g-1",
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("submits a re-group edit, sending the newly selected groupId", async () => {
		trpcMocks.gameVariantUpdate.mockResolvedValue(
			variantRow({ groupId: "g-2" })
		);
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: null,
					editingVariant: variantRow(),
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("groupId", "g-2");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameVariantUpdate).toHaveBeenNthCalledWith(1, {
			id: "v-1",
			label: "Big Duck",
			shortLabel: "BD",
			groupId: "g-2",
		});
	});

	it("blocks an edit submit with a blank label", async () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: null,
					editingVariant: variantRow(),
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "   ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(trpcMocks.gameVariantUpdate).not.toHaveBeenCalled();
	});

	it("keeps the sheet open and toasts on create failure", async () => {
		trpcMocks.gameVariantCreate.mockRejectedValue(new Error("CONFLICT"));
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: "g-1",
					editingVariant: null,
					groups: GROUPS,
					onOpenChange,
				}),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.form.setFieldValue("label", "Razz");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(toastMock.error).toHaveBeenNthCalledWith(
			1,
			"Failed to create game variant"
		);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("keeps the sheet open and toasts on update failure", async () => {
		trpcMocks.gameVariantUpdate.mockRejectedValue(new Error("CONFLICT"));
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: null,
					editingVariant: variantRow(),
					groups: GROUPS,
					onOpenChange,
				}),
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
			"Failed to update game variant"
		);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("resets the form and forwards the close through onOpenChange", () => {
		const onOpenChange = vi.fn();
		const { result } = renderHook(
			() =>
				useVariantFormSheet({
					createGroupId: "g-1",
					editingVariant: null,
					groups: GROUPS,
					onOpenChange,
				}),
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
});
