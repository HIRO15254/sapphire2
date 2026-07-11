import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameVariantListQueryFn: vi.fn(),
	gameVariantCreate: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: () => trpcMocks.gameVariantListQueryFn(),
				}),
			},
		},
	},
	trpcClient: {
		gameVariant: {
			create: { mutate: trpcMocks.gameVariantCreate },
		},
	},
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { ADD_CUSTOM_VALUE, useVariantSelect } from "../use-variant-select";

function customRow(label: string) {
	return {
		id: `cv-${label}`,
		userId: "u-1",
		label,
		blind1Label: null,
		blind2Label: null,
		blind3Label: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

describe("useVariantSelect", () => {
	beforeEach(() => {
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([]);
		trpcMocks.gameVariantCreate.mockReset();
		toastMock.error.mockReset();
	});

	it("lists presets without mix by default and with mix when includeMix", () => {
		const { result } = renderHook(
			() => useVariantSelect({ value: "nlh", onChange: vi.fn() }),
			{ wrapper: withQueryClient() }
		);
		const keys = result.current.presets.map((p) => p.key);
		expect(keys).toContain("nlh");
		expect(keys).toContain("stud");
		expect(keys).not.toContain("mix");

		const withMix = renderHook(
			() =>
				useVariantSelect({ value: "nlh", onChange: vi.fn(), includeMix: true }),
			{ wrapper: withQueryClient() }
		);
		expect(withMix.result.current.presets.map((p) => p.key)).toContain("mix");
	});

	it("exposes fetched custom variants sorted by the server", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([
			customRow("Big Duck"),
			customRow("Sviten Special"),
		]);
		const { result } = renderHook(
			() => useVariantSelect({ value: "nlh", onChange: vi.fn() }),
			{ wrapper: withQueryClient() }
		);
		await waitFor(() => {
			expect(result.current.customVariants.map((c) => c.label)).toEqual([
				"Big Duck",
				"Sviten Special",
			]);
		});
	});

	it("excludes excluded variants case-insensitively but never the current value", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([
			customRow("Big Duck"),
			customRow("Sviten Special"),
		]);
		const { result } = renderHook(
			() =>
				useVariantSelect({
					value: "plo",
					onChange: vi.fn(),
					excludeVariants: ["PLO", "nlh", "big duck"],
				}),
			{ wrapper: withQueryClient() }
		);
		await waitFor(() => {
			expect(result.current.customVariants.map((c) => c.label)).toEqual([
				"Sviten Special",
			]);
		});
		const keys = result.current.presets.map((p) => p.key);
		expect(keys).not.toContain("nlh");
		// The row's own selection stays in the list even though it is "used".
		expect(keys).toContain("plo");
	});

	it("reports an unknown selected value so the UI can still display it", async () => {
		trpcMocks.gameVariantListQueryFn.mockResolvedValue([customRow("Big Duck")]);
		const { result } = renderHook(
			() => useVariantSelect({ value: "Deleted Game", onChange: vi.fn() }),
			{ wrapper: withQueryClient() }
		);
		await waitFor(() => {
			expect(trpcMocks.gameVariantListQueryFn).toHaveBeenCalledTimes(1);
		});
		expect(result.current.unknownValue).toBe("Deleted Game");

		const known = renderHook(
			() => useVariantSelect({ value: "Big Duck", onChange: vi.fn() }),
			{ wrapper: withQueryClient() }
		);
		await waitFor(() => {
			expect(known.result.current.unknownValue).toBeNull();
		});
	});

	it("passes normal selections through to onChange", () => {
		const onChange = vi.fn();
		const { result } = renderHook(
			() => useVariantSelect({ value: "nlh", onChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.handleValueChange("plo");
		});
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenNthCalledWith(1, "plo");
	});

	it("intercepts the add-custom sentinel: opens the sheet, no onChange", () => {
		const onChange = vi.fn();
		const { result } = renderHook(
			() => useVariantSelect({ value: "nlh", onChange }),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.isAddOpen).toBe(false);
		act(() => {
			result.current.handleValueChange(ADD_CUSTOM_VALUE);
		});
		expect(result.current.isAddOpen).toBe(true);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("creates a custom variant, selects it, closes the sheet, and invalidates the list", async () => {
		const created = customRow("Sviten Special");
		trpcMocks.gameVariantCreate.mockResolvedValue(created);
		const onChange = vi.fn();
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(
			() => useVariantSelect({ value: "nlh", onChange }),
			{ wrapper: withQueryClient(queryClient) }
		);
		act(() => {
			result.current.handleValueChange(ADD_CUSTOM_VALUE);
		});
		act(() => {
			result.current.form.setFieldValue("label", "  Sviten Special ");
			result.current.form.setFieldValue("blind1Label", "Button ");
			result.current.form.setFieldValue("blind2Label", "");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(onChange).toHaveBeenCalledTimes(1);
		});
		expect(trpcMocks.gameVariantCreate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.gameVariantCreate).toHaveBeenNthCalledWith(1, {
			label: "Sviten Special",
			blind1Label: "Button",
			blind2Label: null,
			blind3Label: null,
		});
		expect(onChange).toHaveBeenNthCalledWith(1, "Sviten Special");
		expect(result.current.isAddOpen).toBe(false);
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["gameVariant", "list"],
		});
	});

	it("keeps the sheet open and toasts on create failure", async () => {
		trpcMocks.gameVariantCreate.mockRejectedValue(new Error("CONFLICT"));
		const onChange = vi.fn();
		const { result } = renderHook(
			() => useVariantSelect({ value: "nlh", onChange }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.handleValueChange(ADD_CUSTOM_VALUE);
		});
		act(() => {
			result.current.form.setFieldValue("label", "PLO");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		await waitFor(() => {
			expect(toastMock.error).toHaveBeenCalledTimes(1);
		});
		expect(result.current.isAddOpen).toBe(true);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("blocks submission when the label is blank", async () => {
		const { result } = renderHook(
			() => useVariantSelect({ value: "nlh", onChange: vi.fn() }),
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
});
