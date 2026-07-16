import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const formStateMock = vi.hoisted(() => ({
	handleSubmit: vi.fn(),
	onSubmitInvalid: undefined as ((fieldNames: string[]) => void) | undefined,
}));

vi.mock(
	"@/features/sessions/components/session-wizard/use-session-form-state",
	() => ({
		useSessionFormState: (args: {
			onSubmitInvalid?: (fieldNames: string[]) => void;
		}) => {
			formStateMock.onSubmitInvalid = args.onSubmitInvalid;
			return { form: { handleSubmit: formStateMock.handleSubmit } };
		},
	})
);

import {
	firstInvalidWizardStep,
	useSessionWizard,
	wizardStepsForMode,
} from "@/features/sessions/components/session-wizard/use-session-wizard";

describe("wizardStepsForMode", () => {
	it("returns the result flow for manual sessions", () => {
		expect(wizardStepsForMode("manual").map((step) => step.key)).toEqual([
			"master",
			"rules",
			"result",
		]);
	});

	it("returns the start flow for live sessions", () => {
		expect(wizardStepsForMode("live").map((step) => step.key)).toEqual([
			"master",
			"rules",
			"start",
		]);
	});
});

describe("firstInvalidWizardStep", () => {
	it("prioritizes an invalid rules field over a later result field", () => {
		expect(firstInvalidWizardStep(["buyIn", "blind1"], "manual")).toBe("rules");
	});

	it("maps non-rule errors to the manual result step", () => {
		expect(firstInvalidWizardStep(["buyIn"], "manual")).toBe("result");
	});

	it("maps non-rule errors to the live start step", () => {
		expect(firstInvalidWizardStep(["timerStartedAt"], "live")).toBe("start");
	});

	it("returns null when validation reports no field names", () => {
		expect(firstInvalidWizardStep([], "manual")).toBeNull();
	});
});

describe("useSessionWizard", () => {
	beforeEach(() => {
		formStateMock.handleSubmit.mockReset();
		formStateMock.onSubmitInvalid = undefined;
	});

	it("guards both ends of the manual step sequence", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "manual", onSubmit: vi.fn() })
		);

		expect(result.current.currentStep).toBe("master");
		expect(result.current.stepIndex).toBe(0);
		expect(result.current.isFirstStep).toBe(true);
		expect(result.current.isLastStep).toBe(false);
		act(() => result.current.goToPrev());
		expect(result.current.currentStep).toBe("master");

		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("rules");
		expect(result.current.stepIndex).toBe(1);
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("result");
		expect(result.current.isLastStep).toBe(true);
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("result");
		act(() => result.current.goToPrev());
		expect(result.current.currentStep).toBe("rules");
	});

	it("uses the live start step as the final boundary", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "live", onSubmit: vi.fn() })
		);
		act(() => result.current.goToNext());
		act(() => result.current.goToNext());
		expect(result.current.currentStep).toBe("start");
		expect(result.current.stepIndex).toBe(2);
		expect(result.current.isLastStep).toBe(true);
	});

	it("moves to the first invalid step reported by the form", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "manual", onSubmit: vi.fn() })
		);
		act(() => result.current.setCurrentStep("result"));
		act(() => formStateMock.onSubmitInvalid?.(["blind2", "buyIn"]));
		expect(result.current.currentStep).toBe("rules");
	});

	it("keeps the current step when invalid submit has no field errors", () => {
		const { result } = renderHook(() =>
			useSessionWizard({ mode: "manual", onSubmit: vi.fn() })
		);
		act(() => result.current.setCurrentStep("result"));
		act(() => formStateMock.onSubmitInvalid?.([]));
		expect(result.current.currentStep).toBe("result");
	});

	it("resets to a valid step when mode changes and the current step disappears", async () => {
		const { result, rerender } = renderHook(
			({ mode }: { mode: "manual" | "live" }) =>
				useSessionWizard({ mode, onSubmit: vi.fn() }),
			{ initialProps: { mode: "manual" as const } }
		);
		act(() => result.current.setCurrentStep("result"));
		rerender({ mode: "live" });

		await waitFor(() => {
			expect(result.current.currentStep).toBe("master");
			expect(result.current.stepIndex).toBe(0);
		});
	});
});
