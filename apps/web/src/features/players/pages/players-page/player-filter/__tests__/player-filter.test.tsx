import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerFilter } from "@/features/players/pages/players-page/player-filter";

const TAGS = [
	{ id: "vip", name: "VIP", color: "blue" },
	{ id: "reg", name: "Regular", color: "red" },
];

describe("PlayerFilter", () => {
	it("renders nothing when there are no tags", () => {
		const { container } = render(
			<PlayerFilter availableTags={[]} onToggle={vi.fn()} selectedTagIds={[]} />
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders a toggle chip for each available tag", () => {
		render(
			<PlayerFilter
				availableTags={TAGS}
				onToggle={vi.fn()}
				selectedTagIds={[]}
			/>
		);
		expect(screen.getByRole("button", { name: "VIP" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Regular" })).toBeInTheDocument();
	});

	it("marks selected chips with aria-pressed=true and others false", () => {
		render(
			<PlayerFilter
				availableTags={TAGS}
				onToggle={vi.fn()}
				selectedTagIds={["vip"]}
			/>
		);
		expect(screen.getByRole("button", { name: "VIP" })).toHaveAttribute(
			"aria-pressed",
			"true"
		);
		expect(screen.getByRole("button", { name: "Regular" })).toHaveAttribute(
			"aria-pressed",
			"false"
		);
	});

	it("calls onToggle with the tag id when a chip is clicked", async () => {
		const user = userEvent.setup();
		const onToggle = vi.fn();
		render(
			<PlayerFilter
				availableTags={TAGS}
				onToggle={onToggle}
				selectedTagIds={[]}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Regular" }));
		expect(onToggle).toHaveBeenCalledTimes(1);
		expect(onToggle).toHaveBeenCalledWith("reg");
	});
});
