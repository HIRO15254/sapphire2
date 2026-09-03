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

	it.each([
		{ visibleCount: 99, shown: ["Fish", "Reg", "Whale"], overflow: null },
		{ visibleCount: 1, shown: ["Fish"], overflow: "+2" },
		{ visibleCount: 0, shown: [], overflow: "+3" },
	])("shows the first $visibleCount tags and collapses the rest into $overflow", ({
		visibleCount,
		shown,
		overflow,
	}) => {
		mocks.visibleCount = visibleCount;
		render(
			<PlayerTagBadges
				tags={[tag("t1", "Fish"), tag("t2", "Reg"), tag("t3", "Whale")]}
			/>
		);
		const v = visible();
		expect(
			["Fish", "Reg", "Whale"].filter((name) => v.queryByText(name))
		).toEqual(shown);
		if (overflow === null) {
			expect(v.queryByText(REGEX_PLUS)).not.toBeInTheDocument();
		} else {
			expect(v.getByText(overflow)).toBeInTheDocument();
		}
	});
});
