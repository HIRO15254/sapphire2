import { renderHook } from "@testing-library/react";
import type { FocusEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BlindLevelRow } from "@/features/stores/hooks/use-blind-levels";
import { useSortableLevelRow } from "@/features/stores/hooks/use-sortable-level-row";

function makeRow(overrides: Partial<BlindLevelRow> = {}): BlindLevelRow {
	return {
		id: "l1",
		tournamentId: "t1",
		level: 1,
		isBreak: false,
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
		minutes: null,
		...overrides,
	};
}

function buildFocusEvent(value: string) {
	const input = document.createElement("input");
	input.value = value;
	return { target: input } as unknown as FocusEvent<HTMLInputElement>;
}

describe("useSortableLevelRow", () => {
	describe("handleBlind1Blur auto-fill", () => {
		it("computes blind2 = blind1 * 2 and ante = blind2 when both empty", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({ row: makeRow(), onUpdate })
			);
			result.current.handleBlind1Blur(buildFocusEvent("100"));
			expect(onUpdate).toHaveBeenCalledWith("l1", {
				blind1: 100,
				blind2: 200,
				ante: 200,
			});
		});

		it("only fills ante when blind2 already exists", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({
					row: makeRow({ blind2: 50 }),
					onUpdate,
				})
			);
			result.current.handleBlind1Blur(buildFocusEvent("20"));
			expect(onUpdate).toHaveBeenCalledWith("l1", {
				blind1: 20,
				ante: 20,
			});
		});

		it("skips ante auto-fill when ante is already set", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({
					row: makeRow({ blind2: 50, ante: 40 }),
					onUpdate,
				})
			);
			result.current.handleBlind1Blur(buildFocusEvent("25"));
			expect(onUpdate).toHaveBeenCalledWith("l1", { blind1: 25 });
		});

		it("sends only blind1 update when blind1 input becomes empty", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({
					row: makeRow({ blind1: 100, blind2: 200, ante: 200 }),
					onUpdate,
				})
			);
			result.current.handleBlind1Blur(buildFocusEvent(""));
			expect(onUpdate).toHaveBeenCalledWith("l1", { blind1: null });
		});

		it("sends only blind1 update when blind1 input is unparseable", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({
					row: makeRow({ blind1: 100, blind2: 200 }),
					onUpdate,
				})
			);
			result.current.handleBlind1Blur(buildFocusEvent("abc"));
			expect(onUpdate).toHaveBeenCalledWith("l1", { blind1: null });
		});
	});

	describe("handleBlind2Blur", () => {
		it("updates blind2 and auto-fills ante when ante is empty", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({ row: makeRow({ blind1: 50 }), onUpdate })
			);
			result.current.handleBlind2Blur(buildFocusEvent("120"));
			expect(onUpdate).toHaveBeenCalledWith("l1", {
				blind2: 120,
				ante: 120,
			});
		});

		it("does not overwrite ante when already populated", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({
					row: makeRow({ blind1: 50, ante: 25 }),
					onUpdate,
				})
			);
			result.current.handleBlind2Blur(buildFocusEvent("120"));
			expect(onUpdate).toHaveBeenCalledWith("l1", { blind2: 120 });
		});

		it("sends blind2=null when input is cleared", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({
					row: makeRow({ blind1: 50, blind2: 120 }),
					onUpdate,
				})
			);
			result.current.handleBlind2Blur(buildFocusEvent(""));
			expect(onUpdate).toHaveBeenCalledWith("l1", { blind2: null });
		});
	});

	describe("handleAnteBlur", () => {
		it("updates ante with parsed value", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({ row: makeRow(), onUpdate })
			);
			result.current.handleAnteBlur(buildFocusEvent("80"));
			expect(onUpdate).toHaveBeenCalledWith("l1", { ante: 80 });
		});

		it("updates ante with null when cleared", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({ row: makeRow({ ante: 50 }), onUpdate })
			);
			result.current.handleAnteBlur(buildFocusEvent(""));
			expect(onUpdate).toHaveBeenCalledWith("l1", { ante: null });
		});
	});

	describe("handleMinutesBlur", () => {
		it("forwards minutes with parsed value", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({ row: makeRow(), onUpdate })
			);
			result.current.handleMinutesBlur(buildFocusEvent("20"));
			expect(onUpdate).toHaveBeenCalledWith("l1", { minutes: 20 });
		});

		it("forwards minutes=null when cleared", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({ row: makeRow({ minutes: 15 }), onUpdate })
			);
			result.current.handleMinutesBlur(buildFocusEvent(""));
			expect(onUpdate).toHaveBeenCalledWith("l1", { minutes: null });
		});
	});

	describe("autofill state tracked via refs across blurs", () => {
		it("after blind2 is set via handleBlind2Blur (which also fills ante), handleBlind1Blur sends blind1 alone", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({ row: makeRow(), onUpdate })
			);
			// This sets blind2Ref="300" AND anteRef="300" because ante was empty.
			result.current.handleBlind2Blur(buildFocusEvent("300"));
			onUpdate.mockClear();
			result.current.handleBlind1Blur(buildFocusEvent("40"));
			// blind2 is populated → skip *2 branch; ante is populated → skip ante
			// auto-fill. Only blind1 is forwarded.
			expect(onUpdate).toHaveBeenCalledWith("l1", { blind1: 40 });
		});

		it("handleAnteBlur causes subsequent handleBlind2Blur to skip ante autofill", () => {
			const onUpdate = vi.fn();
			const { result } = renderHook(() =>
				useSortableLevelRow({ row: makeRow(), onUpdate })
			);
			result.current.handleAnteBlur(buildFocusEvent("5"));
			onUpdate.mockClear();
			result.current.handleBlind2Blur(buildFocusEvent("400"));
			expect(onUpdate).toHaveBeenCalledWith("l1", { blind2: 400 });
		});
	});
});
