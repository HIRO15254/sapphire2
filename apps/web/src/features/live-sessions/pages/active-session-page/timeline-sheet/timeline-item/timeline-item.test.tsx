import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TimelineItemViewModel } from "./timeline-item";
import { TimelineItem } from "./timeline-item";

const MIDDOT_PATTERN = /·/;
const SIGNED_AMOUNT_PATTERN = /^[+-][\d,]+$/;

function buildItem(
	overrides: Partial<TimelineItemViewModel> = {}
): TimelineItemViewModel {
	return {
		id: "e1",
		time: "09:05",
		dotClass: "bg-primary",
		title: "Stack update",
		sub: null,
		amountText: null,
		onEdit: vi.fn(),
		...overrides,
	};
}

describe("TimelineItem", () => {
	it("renders the time and title", () => {
		render(<TimelineItem item={buildItem()} />);
		expect(screen.getByText("09:05")).toBeInTheDocument();
		expect(screen.getByText("Stack update")).toBeInTheDocument();
	});

	it("renders the sub line when present", () => {
		render(<TimelineItem item={buildItem({ sub: "Stack: 91,429 · 40/42" })} />);
		expect(screen.getByText("Stack: 91,429 · 40/42")).toBeInTheDocument();
	});

	it("renders no sub line when absent", () => {
		render(<TimelineItem item={buildItem({ sub: null })} />);
		expect(screen.queryByText(MIDDOT_PATTERN)).not.toBeInTheDocument();
	});

	it("renders the amount when present", () => {
		render(<TimelineItem item={buildItem({ amountText: "+5,000" })} />);
		expect(screen.getByText("+5,000")).toBeInTheDocument();
	});

	it("renders no amount when absent", () => {
		render(<TimelineItem item={buildItem({ amountText: null })} />);
		expect(screen.queryByText(SIGNED_AMOUNT_PATTERN)).not.toBeInTheDocument();
	});

	it("calls onEdit exactly once when tapped", async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		render(<TimelineItem item={buildItem({ onEdit })} />);
		await user.click(
			screen.getByText("Stack update").closest("button") as HTMLButtonElement
		);
		expect(onEdit).toHaveBeenCalledTimes(1);
	});

	it("draws a continuous rail line and a ringed dot colored by dotClass", () => {
		const { container } = render(
			<TimelineItem item={buildItem({ dotClass: "bg-warning" })} />
		);
		const line = container.querySelector(".bg-border");
		expect(line).not.toBeNull();
		const dot = container.querySelector(".border-background");
		expect(dot).not.toBeNull();
		expect(dot?.className).toContain("bg-warning");
		expect(dot?.className).toContain("rounded-full");
	});
});
