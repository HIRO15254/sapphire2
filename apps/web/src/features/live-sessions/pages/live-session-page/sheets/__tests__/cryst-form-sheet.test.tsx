import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CrystFormSheet } from "@/features/live-sessions/pages/live-session-page/sheets/cryst-form-sheet";

describe("CrystFormSheet", () => {
	it("carries the Cryst scope class into the portalled sheet content", () => {
		render(
			<CrystFormSheet formId="x" onOpenChange={vi.fn()} open title="t">
				<div data-testid="sheet-body" />
			</CrystFormSheet>
		);
		expect(screen.getByTestId("sheet-body").closest(".cryst")).not.toBeNull();
	});
});
