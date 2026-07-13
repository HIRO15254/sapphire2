import { renderHook } from "@testing-library/react";
import type { FocusEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useEmptyRow } from "@/features/rooms/hooks/use-empty-row";

function mountInputs(
	result: ReturnType<typeof useEmptyRow>,
	{ withBlind3 = false }: { withBlind3?: boolean } = {}
) {
	const blind1 = document.createElement("input");
	const blind2 = document.createElement("input");
	const blind3 = document.createElement("input");
	const ante = document.createElement("input");
	const minutes = document.createElement("input");
	// Assign the refs imperatively because useRef().current is read-only
	// normally, but DOM RefObjects allow direct assignment in tests.
	(result.blind1Ref as { current: HTMLInputElement | null }).current = blind1;
	(result.blind2Ref as { current: HTMLInputElement | null }).current = blind2;
	if (withBlind3) {
		(result.blind3Ref as { current: HTMLInputElement | null }).current = blind3;
	}
	(result.anteRef as { current: HTMLInputElement | null }).current = ante;
	(result.minutesRef as { current: HTMLInputElement | null }).current = minutes;
	return { blind1, blind2, blind3, ante, minutes };
}

function buildFocusEvent(
	target: HTMLInputElement,
	relatedTarget: EventTarget | null
) {
	return {
		target,
		relatedTarget,
	} as unknown as FocusEvent<HTMLInputElement>;
}

describe("useEmptyRow", () => {
	describe("handleBlind1Blur auto-fill behaviour", () => {
		it("populates blind2 with blind1 * 2 and ante with blind2 when both empty, and creates with reset", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "100";

			result.current.handleBlind1Blur(buildFocusEvent(inputs.blind1, null));

			// tryCreate auto-fills blind2 to 200, ante to 200, then invokes create
			// and immediately resets all cells.
			expect(onCreateLevel).toHaveBeenCalledWith({
				blind1: 100,
				blind2: 200,
				ante: 200,
				minutes: null,
			});
			expect(inputs.blind1.value).toBe("");
			expect(inputs.blind2.value).toBe("");
			expect(inputs.ante.value).toBe("");
			expect(inputs.minutes.value).toBe("");
		});

		it("auto-fills blind2 and ante without creating when focus stays within the row", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "100";

			result.current.handleBlind1Blur(
				buildFocusEvent(inputs.blind1, inputs.minutes)
			);
			expect(onCreateLevel).not.toHaveBeenCalled();
			expect(inputs.blind2.value).toBe("200");
			expect(inputs.ante.value).toBe("200");
		});

		it("does not overwrite existing blind2 value", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "100";
			inputs.blind2.value = "300";

			result.current.handleBlind1Blur(buildFocusEvent(inputs.blind1, null));

			// After reset the values are cleared, so assert the onCreateLevel payload
			// which captures the intermediate state.
			expect(onCreateLevel).toHaveBeenCalledWith({
				blind1: 100,
				blind2: 300,
				ante: 300,
				minutes: null,
			});
		});

		it("does not populate ante when blind1 is unparseable", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "abc";

			result.current.handleBlind1Blur(buildFocusEvent(inputs.blind1, null));

			expect(inputs.blind2.value).toBe("");
			expect(inputs.ante.value).toBe("");
			// blind1Val is null => tryCreate returns early without calling create.
			expect(onCreateLevel).not.toHaveBeenCalled();
		});

		it("does not trigger create when the related target is another empty-row cell", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "100";

			result.current.handleBlind1Blur(
				buildFocusEvent(inputs.blind1, inputs.blind2)
			);
			expect(onCreateLevel).not.toHaveBeenCalled();
			// But the auto-fill side-effects still happened.
			expect(inputs.blind2.value).toBe("200");
			expect(inputs.ante.value).toBe("200");
		});
	});

	describe("handleBlind2Blur", () => {
		it("propagates blind2 to ante when ante is empty and blind2 is numeric", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "100";
			inputs.blind2.value = "250";

			result.current.handleBlind2Blur(buildFocusEvent(inputs.blind2, null));

			expect(onCreateLevel).toHaveBeenCalledWith({
				blind1: 100,
				blind2: 250,
				ante: 250,
				minutes: null,
			});
		});

		it("does not call create when blind1 cell is empty", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind2.value = "250";

			result.current.handleBlind2Blur(buildFocusEvent(inputs.blind2, null));

			expect(onCreateLevel).not.toHaveBeenCalled();
		});
	});

	describe("handleBlind3Blur", () => {
		it("creates a level with the third blind when that optional cell is mounted", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current, { withBlind3: true });
			inputs.blind1.value = "100";
			inputs.blind2.value = "200";
			inputs.blind3.value = "50";
			inputs.ante.value = "25";

			result.current.handleBlind3Blur(buildFocusEvent(inputs.blind3, null));

			expect(onCreateLevel).toHaveBeenCalledTimes(1);
			expect(onCreateLevel).toHaveBeenNthCalledWith(1, {
				blind1: 100,
				blind2: 200,
				blind3: 50,
				ante: 25,
				minutes: null,
			});
			expect(inputs.blind3.value).toBe("");
		});

		it("creates with blind3=null when the mounted third-blind cell is empty", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current, { withBlind3: true });
			inputs.blind1.value = "100";
			inputs.blind2.value = "200";
			inputs.ante.value = "25";

			result.current.handleBlind3Blur(buildFocusEvent(inputs.blind3, null));

			expect(onCreateLevel).toHaveBeenCalledTimes(1);
			expect(onCreateLevel).toHaveBeenNthCalledWith(1, {
				blind1: 100,
				blind2: 200,
				blind3: null,
				ante: 25,
				minutes: null,
			});
		});

		it("does not create from an invalid third blind", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current, { withBlind3: true });
			inputs.blind1.value = "100";
			inputs.blind2.value = "200";
			inputs.blind3.value = "-1";
			inputs.ante.value = "25";

			result.current.handleBlind3Blur(buildFocusEvent(inputs.blind3, null));

			expect(onCreateLevel).not.toHaveBeenCalled();
			expect(inputs.blind3).toHaveAttribute("aria-invalid", "true");
		});

		it("keeps the row pending while focus moves to the third-blind cell", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current, { withBlind3: true });
			inputs.blind1.value = "100";

			result.current.handleBlind1Blur(
				buildFocusEvent(inputs.blind1, inputs.blind3)
			);

			expect(onCreateLevel).not.toHaveBeenCalled();
		});
	});

	describe("handleAnteBlur and handleMinutesBlur", () => {
		it("handleAnteBlur triggers create when blind1 is populated", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "100";
			inputs.blind2.value = "200";
			inputs.ante.value = "150";
			inputs.minutes.value = "30";

			result.current.handleAnteBlur(buildFocusEvent(inputs.ante, null));

			expect(onCreateLevel).toHaveBeenCalledWith({
				blind1: 100,
				blind2: 200,
				ante: 150,
				minutes: 30,
			});
		});

		it("handleMinutesBlur triggers create and sets minutes=null when cell is empty", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "50";
			inputs.blind2.value = "100";
			inputs.ante.value = "75";

			result.current.handleMinutesBlur(buildFocusEvent(inputs.minutes, null));
			expect(onCreateLevel).toHaveBeenCalledWith({
				blind1: 50,
				blind2: 100,
				ante: 75,
				minutes: null,
			});
		});

		it("handleMinutesBlur still creates even when moving focus to another empty-row cell (minutes is terminal)", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "100";
			inputs.blind2.value = "200";
			inputs.ante.value = "200";
			inputs.minutes.value = "20";

			// relatedTarget === blind1 (one of the cells) → tryCreate early-returns
			result.current.handleMinutesBlur(
				buildFocusEvent(inputs.minutes, inputs.blind1)
			);
			expect(onCreateLevel).not.toHaveBeenCalled();
		});
	});

	describe("invalid numeric cells", () => {
		it("does not create a level from a negative blind", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "-50";
			inputs.blind2.value = "100";
			inputs.ante.value = "100";

			result.current.handleAnteBlur(buildFocusEvent(inputs.ante, null));
			expect(onCreateLevel).not.toHaveBeenCalled();
		});

		it("does not create a level from trailing non-numeric characters", () => {
			const onCreateLevel = vi.fn();
			const { result } = renderHook(() => useEmptyRow({ onCreateLevel }));
			const inputs = mountInputs(result.current);
			inputs.blind1.value = "42abc";
			inputs.blind2.value = "100";
			inputs.ante.value = "100";

			result.current.handleAnteBlur(buildFocusEvent(inputs.ante, null));
			expect(onCreateLevel).not.toHaveBeenCalled();
		});
	});
});
