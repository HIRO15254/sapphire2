import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	visibleCount: 99,
}));

vi.mock("./use-player-tag-badges", () => ({
	usePlayerTagBadges: () => ({
		containerRef: { current: null },
		ghostRef: { current: null },
		visibleCount: mocks.visibleCount,
	}),
}));

import { PlayerTagBadges } from "@/features/live-sessions/components/active-session-scene/seat-list/player-tag-badges";

const REGEX_PLUS = /^\+/;

function tag(id: string, name: string) {
	return { color: "gray", id, name };
}

function visible() {
	// The measurement ghost duplicates tag text in the DOM; assert against the
	// visible (non-aria-hidden) cluster only.
	const root = screen.getByTestId("tag-cluster");
	const ghost = within(root).getByTestId("tag-ghost");
	ghost.remove();
	return within(root);
}

describe("PlayerTagBadges", () => {
	beforeEach(() => {
		mocks.visibleCount = 99;
	});

	it("renders nothing when there are no tags", () => {
		const { container } = render(<PlayerTagBadges tags={[]} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders every tag and no +N when they all fit", () => {
		render(<PlayerTagBadges tags={[tag("t1", "Fish"), tag("t2", "Reg")]} />);
		const v = visible();
		expect(v.getByText("Fish")).toBeInTheDocument();
		expect(v.getByText("Reg")).toBeInTheDocument();
		expect(v.queryByText(REGEX_PLUS)).not.toBeInTheDocument();
	});

	it("collapses the tags that do not fit into a +N badge", () => {
		mocks.visibleCount = 1;
		render(
			<PlayerTagBadges
				tags={[tag("t1", "Fish"), tag("t2", "Reg"), tag("t3", "Whale")]}
			/>
		);
		const v = visible();
		expect(v.getByText("Fish")).toBeInTheDocument();
		expect(v.queryByText("Reg")).not.toBeInTheDocument();
		expect(v.queryByText("Whale")).not.toBeInTheDocument();
		expect(v.getByText("+2")).toBeInTheDocument();
	});

	it("shows only the +N badge when nothing fits", () => {
		mocks.visibleCount = 0;
		render(<PlayerTagBadges tags={[tag("t1", "Fish"), tag("t2", "Reg")]} />);
		const v = visible();
		expect(v.queryByText("Fish")).not.toBeInTheDocument();
		expect(v.getByText("+2")).toBeInTheDocument();
	});
});
