import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	StatsFilterSheet,
	StatsVariantOption,
	UseStatsFilterBarResult,
} from "@/features/statistics/components/stats-filter-bar/use-stats-filter-bar";
import type { StatsFilters } from "@/features/statistics/utils/stats-filters";

const VARIANT_UNSET_RE = /Variant:\s*Variant/;
const VARIANT_PLO5_RE = /Variant:\s*PLO5/;

const mocks = vi.hoisted(() => ({
	activeSheet: null as StatsFilterSheet | null,
	closeSheet: vi.fn(),
	openSheet: vi.fn(),
	onVariantChange: vi.fn(),
	filters: { period: "all", norm: "off", type: "all" } as StatsFilters,
	variants: [
		{ id: "v1", name: "NLH" },
		{ id: "v2", name: "PLO5" },
	] as StatsVariantOption[],
}));

function baseHookResult(): UseStatsFilterBarResult {
	return {
		activeSheet: mocks.activeSheet,
		closeSheet: mocks.closeSheet,
		openSheet: mocks.openSheet,
		filters: mocks.filters,
		currencies: [],
		rooms: [],
		variants: mocks.variants,
		isReferenceLoading: false,
		isScopeValid: true,
		currencyChipLabel: "All currencies",
		currentCurrencyName: null,
		currentRoomName: null,
		onPeriodChange: vi.fn(),
		onNormChange: vi.fn(),
		onTypeChange: vi.fn(),
		onCurrencyChange: vi.fn(),
		onRoomChange: vi.fn(),
		onVariantChange: mocks.onVariantChange,
		onFromChange: vi.fn(),
		onToChange: vi.fn(),
	};
}

vi.mock(
	"@/features/statistics/components/stats-filter-bar/use-stats-filter-bar",
	() => ({
		useStatsFilterBar: () => baseHookResult(),
	})
);

import { StatsFilterBar } from "@/features/statistics/components/stats-filter-bar/stats-filter-bar";

describe("StatsFilterBar", () => {
	beforeEach(() => {
		mocks.activeSheet = null;
		mocks.closeSheet.mockReset();
		mocks.openSheet.mockReset();
		mocks.onVariantChange.mockReset();
		mocks.filters = { period: "all", norm: "off", type: "all" } as StatsFilters;
		mocks.variants = [
			{ id: "v1", name: "NLH" },
			{ id: "v2", name: "PLO5" },
		];
	});

	describe("variant chip", () => {
		it('shows "Variant" as the value when no variant is selected', () => {
			render(<StatsFilterBar />);
			const chip = screen.getByRole("button", { name: VARIANT_UNSET_RE });
			expect(chip).toBeInTheDocument();
		});

		it("shows the selected variant name as the chip value", () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				variant: "PLO5",
			} as StatsFilters;
			render(<StatsFilterBar />);
			expect(
				screen.getByRole("button", { name: VARIANT_PLO5_RE })
			).toBeInTheDocument();
		});

		it("opens the variant sheet when clicked", async () => {
			const user = userEvent.setup();
			render(<StatsFilterBar />);
			await user.click(screen.getByRole("button", { name: VARIANT_UNSET_RE }));
			expect(mocks.openSheet).toHaveBeenCalledTimes(1);
			expect(mocks.openSheet).toHaveBeenNthCalledWith(1, "variant");
		});
	});

	describe("variant sheet", () => {
		beforeEach(() => {
			mocks.activeSheet = "variant";
		});

		it("lists the user's variants by name", () => {
			render(<StatsFilterBar />);
			expect(screen.getByText("NLH")).toBeInTheDocument();
			expect(screen.getByText("PLO5")).toBeInTheDocument();
		});

		it("selecting a variant option calls onVariantChange with its name", async () => {
			const user = userEvent.setup();
			render(<StatsFilterBar />);
			await user.click(screen.getByText("PLO5"));
			expect(mocks.onVariantChange).toHaveBeenCalledTimes(1);
			expect(mocks.onVariantChange).toHaveBeenNthCalledWith(1, "PLO5");
		});

		it('clicking "All variants" calls onVariantChange with undefined', async () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				variant: "PLO5",
			} as StatsFilters;
			const user = userEvent.setup();
			render(<StatsFilterBar />);
			await user.click(screen.getByText("All variants"));
			expect(mocks.onVariantChange).toHaveBeenCalledTimes(1);
			expect(mocks.onVariantChange).toHaveBeenNthCalledWith(1, undefined);
		});
	});
});
