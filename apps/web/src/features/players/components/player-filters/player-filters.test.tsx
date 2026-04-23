import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PlayerFilters } from "./player-filters";

const VIP_TAG = { color: "blue", id: "vip", name: "VIP" };
const REG_TAG = { color: "red", id: "reg", name: "Regular" };
const FILTER_BUTTON_LABEL = /^Filter(?: \d+)?$/;

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
});

describe("PlayerFilters", () => {
	it("shows the empty state when no tags are available", async () => {
		const user = userEvent.setup();

		render(
			<PlayerFilters
				availableTags={[]}
				onTagIdsChange={vi.fn()}
				selectedTagIds={[]}
			/>
		);

		await user.click(screen.getByRole("button", { name: FILTER_BUTTON_LABEL }));

		expect(screen.getByText("No tags available")).toBeInTheDocument();
	});

	it("applies selected tags from the combobox", async () => {
		const user = userEvent.setup();
		const onTagIdsChange = vi.fn();

		render(
			<PlayerFilters
				availableTags={[VIP_TAG, REG_TAG]}
				onTagIdsChange={onTagIdsChange}
				selectedTagIds={[]}
			/>
		);

		await user.click(screen.getByRole("button", { name: FILTER_BUTTON_LABEL }));
		await user.click(screen.getByLabelText("Search player tags"));
		await user.click(screen.getByText("VIP"));
		await user.click(screen.getByRole("button", { name: "Apply" }));

		expect(onTagIdsChange).toHaveBeenCalledWith(["vip"]);
	});

	it("renders a selected-count badge equal to the number of initially selected tag ids", () => {
		render(
			<PlayerFilters
				availableTags={[VIP_TAG, REG_TAG]}
				onTagIdsChange={vi.fn()}
				selectedTagIds={["vip", "reg"]}
			/>
		);
		expect(screen.getByText("2")).toBeInTheDocument();
	});

	it("does not show the count badge when no tags are selected", () => {
		render(
			<PlayerFilters
				availableTags={[VIP_TAG, REG_TAG]}
				onTagIdsChange={vi.fn()}
				selectedTagIds={[]}
			/>
		);
		// "Filter" button text should be present without a trailing count.
		expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
	});

	it("resets the selected tags", async () => {
		const user = userEvent.setup();
		const onTagIdsChange = vi.fn();

		render(
			<PlayerFilters
				availableTags={[VIP_TAG]}
				onTagIdsChange={onTagIdsChange}
				selectedTagIds={["vip"]}
			/>
		);

		expect(screen.getByText("1")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: FILTER_BUTTON_LABEL }));
		await user.click(screen.getByRole("button", { name: "Reset" }));

		expect(onTagIdsChange).toHaveBeenCalledWith([]);
	});
});
