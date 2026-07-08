import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	latestVersion: "v3.2.2" as string | null,
	viewedVersions: new Set<string>(),
	isViewedListLoaded: true,
	markViewed: vi.fn(),
	handleAccordionChange: vi.fn(),
}));

vi.mock("@/features/update-notes/constants", () => ({
	get LATEST_VERSION() {
		return state.latestVersion;
	},
	UPDATE_NOTES: [],
}));

vi.mock("@/features/update-notes/hooks/use-update-notes-viewed", () => ({
	useUpdateNotesViewed: () => ({
		viewedVersions: state.viewedVersions,
		isViewedListLoaded: state.isViewedListLoaded,
		markViewed: state.markViewed,
		handleAccordionChange: state.handleAccordionChange,
	}),
}));

import {
	UpdateNotesProvider,
	useUpdateNotesSheet,
} from "@/features/update-notes/components/update-notes-sheet/use-update-notes-sheet";

function Probe() {
	const { isOpen, close, viewedVersions, onAccordionChange } =
		useUpdateNotesSheet();
	return (
		<div>
			<span data-testid="state">{isOpen ? "open" : "closed"}</span>
			<span data-testid="viewed-count">{viewedVersions.size}</span>
			<button onClick={close} type="button">
				close
			</button>
			<button onClick={() => onAccordionChange(["v3.2.1"])} type="button">
				expand
			</button>
		</div>
	);
}

function renderProvider() {
	return render(createElement(UpdateNotesProvider, null, createElement(Probe)));
}

describe("UpdateNotesProvider auto-open", () => {
	beforeEach(() => {
		state.latestVersion = "v3.2.2";
		state.viewedVersions = new Set();
		state.isViewedListLoaded = true;
		state.markViewed.mockClear();
		state.handleAccordionChange.mockClear();
	});

	it("auto-opens for a user who has not viewed the latest release", () => {
		state.viewedVersions = new Set();
		renderProvider();

		expect(screen.getByTestId("state")).toHaveTextContent("open");
	});

	it("auto-opens when the user has viewed older versions but not the latest", () => {
		state.viewedVersions = new Set(["v3.2.1", "v3.2.0"]);
		renderProvider();

		expect(screen.getByTestId("state")).toHaveTextContent("open");
	});

	it("marks the latest release viewed exactly once when it auto-opens", () => {
		state.viewedVersions = new Set();
		renderProvider();

		expect(state.markViewed).toHaveBeenCalledTimes(1);
		expect(state.markViewed).toHaveBeenCalledWith("v3.2.2");
	});

	it("stays closed and does not mark anything when the latest is already viewed", () => {
		state.viewedVersions = new Set(["v3.2.2"]);
		renderProvider();

		expect(screen.getByTestId("state")).toHaveTextContent("closed");
		expect(state.markViewed).not.toHaveBeenCalled();
	});

	it("stays closed while the viewed list is still loading", () => {
		state.viewedVersions = new Set();
		state.isViewedListLoaded = false;
		renderProvider();

		expect(screen.getByTestId("state")).toHaveTextContent("closed");
		expect(state.markViewed).not.toHaveBeenCalled();
	});

	it("stays closed and does not mark when there is no published release", () => {
		state.latestVersion = null;
		state.viewedVersions = new Set();
		renderProvider();

		expect(screen.getByTestId("state")).toHaveTextContent("closed");
		expect(state.markViewed).not.toHaveBeenCalled();
	});

	it("auto-opens only once — does not reopen after the user closes it", async () => {
		state.viewedVersions = new Set();
		renderProvider();

		expect(screen.getByTestId("state")).toHaveTextContent("open");

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "close" }));

		expect(screen.getByTestId("state")).toHaveTextContent("closed");
		// markViewed fired once on the initial auto-open, not again.
		expect(state.markViewed).toHaveBeenCalledTimes(1);
	});

	it("shares the single viewed-versions set through context", () => {
		state.viewedVersions = new Set(["v3.2.2", "v3.2.1"]);
		renderProvider();

		expect(screen.getByTestId("viewed-count")).toHaveTextContent("2");
	});

	it("forwards accordion changes to the shared hook's handler", async () => {
		state.viewedVersions = new Set(["v3.2.2"]);
		renderProvider();

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "expand" }));

		expect(state.handleAccordionChange).toHaveBeenCalledTimes(1);
		expect(state.handleAccordionChange).toHaveBeenCalledWith(["v3.2.1"]);
	});
});
