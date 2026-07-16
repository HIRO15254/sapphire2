import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/__tests__/test-utils";

const trpcMocks = vi.hoisted(() => ({
	gameGroupListQueryFn: vi.fn(),
	gameVariantListQueryFn: vi.fn(),
	gameMixListQueryFn: vi.fn(),
	gameVariantCreate: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: () => trpcMocks.gameGroupListQueryFn(),
				}),
			},
		},
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: () => trpcMocks.gameVariantListQueryFn(),
				}),
			},
		},
		gameMix: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameMix", "list"],
					queryFn: () => trpcMocks.gameMixListQueryFn(),
				}),
			},
		},
	},
	trpcClient: {
		gameVariant: {
			create: { mutate: trpcMocks.gameVariantCreate },
		},
	},
}));

import { VariantSelect } from "../variant-select";

const GROUPS = [
	{ id: "g-limit", builtinKey: "limit", label: "Limit" },
	{ id: "g-bigbet", builtinKey: "bigbet", label: "Big Bet" },
];

const VARIANTS = [
	{
		id: "v-nlh",
		builtinKey: "nlh",
		label: "NL Hold'em",
		shortLabel: "NLH",
		groupId: "g-bigbet",
		sortOrder: 0,
	},
	{
		id: "v-lhe",
		builtinKey: "lhe",
		label: "Limit Hold'em",
		shortLabel: "LHE",
		groupId: "g-limit",
		sortOrder: 1,
	},
];

const MIXES = [
	{ id: "m-horse", builtinKey: "horse", label: "HORSE", games: [] },
];

function renderSelect({
	disabled = false,
	onChange = vi.fn(),
}: {
	disabled?: boolean;
	onChange?: (variant: string) => void;
} = {}) {
	return {
		onChange,
		...renderWithQueryClient(
			<>
				<VariantSelect
					disabled={disabled}
					includeMix
					onChange={onChange}
					value=""
				/>
				<button type="button">After select</button>
			</>
		),
	};
}

async function openCombobox() {
	const user = userEvent.setup();
	const input = screen.getByRole("combobox");
	await waitFor(() => expect(input).toBeEnabled());
	await user.click(input);
	await screen.findByRole("listbox");
	return { input, user };
}

describe("VariantSelect — combobox keyboard and ARIA", () => {
	beforeEach(() => {
		trpcMocks.gameGroupListQueryFn.mockReset();
		trpcMocks.gameVariantListQueryFn.mockReset();
		trpcMocks.gameMixListQueryFn.mockReset();
		trpcMocks.gameVariantCreate.mockReset();
		trpcMocks.gameGroupListQueryFn.mockResolvedValue(GROUPS);
		trpcMocks.gameVariantListQueryFn.mockResolvedValue(VARIANTS);
		trpcMocks.gameMixListQueryFn.mockResolvedValue(MIXES);
	});

	it("connects the combobox to a listbox with stable option ids and active-descendant state", async () => {
		renderSelect();
		const { input, user } = await openCombobox();
		const listbox = screen.getByRole("listbox");
		const options = screen.getAllByRole("option");
		const optionIds = options.map((option) => option.id);

		expect(input).toHaveAttribute("aria-controls", listbox.id);
		expect(input).not.toHaveAttribute("aria-activedescendant");
		expect(options.map((option) => option.textContent)).toEqual([
			"NL Hold'em",
			"Limit Hold'em",
			"HORSE",
			"Add custom variant",
		]);
		for (const option of options) {
			expect(option.id).not.toBe("");
			expect(option).toHaveAttribute("aria-selected", "false");
		}

		await user.keyboard("{ArrowDown}");
		expect(options[0]).toHaveAttribute("aria-selected", "true");
		expect(input).toHaveAttribute("aria-activedescendant", options[0].id);

		await user.keyboard("{ArrowUp}");
		expect(options[3]).toHaveAttribute("aria-selected", "true");
		expect(input).toHaveAttribute("aria-activedescendant", options[3].id);

		await user.keyboard("{ArrowDown}");
		expect(options[0]).toHaveAttribute("aria-selected", "true");

		await user.keyboard("{Escape}");
		await user.click(screen.getByRole("button", { name: "After select" }));
		await user.click(input);
		await screen.findByRole("listbox");
		expect(screen.getAllByRole("option").map((option) => option.id)).toEqual(
			optionIds
		);
	});

	it("selects the active option with Enter and closes the listbox", async () => {
		const onChange = vi.fn();
		renderSelect({ onChange });
		const { input, user } = await openCombobox();

		await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenNthCalledWith(1, "Limit Hold'em");
		expect(input).toHaveAttribute("aria-expanded", "false");
		expect(input).not.toHaveAttribute("aria-activedescendant");
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("includes custom creation in keyboard navigation", async () => {
		renderSelect();
		const { user } = await openCombobox();

		await user.keyboard("{ArrowUp}{Enter}");

		expect(
			screen.getByRole("heading", { name: "New custom variant" })
		).toBeInTheDocument();
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("closes and restores the committed text with Escape", async () => {
		renderWithQueryClient(
			<VariantSelect includeMix onChange={vi.fn()} value="NL Hold'em" />
		);
		const { input, user } = await openCombobox();
		await user.clear(input);
		await user.type(input, "garbage");

		await user.keyboard("{Escape}");

		expect(input).toHaveValue("NL Hold'em");
		expect(input).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("allows Tab to move focus normally and closes the popover", async () => {
		renderSelect();
		const { user } = await openCombobox();

		await user.tab();

		expect(screen.getByRole("button", { name: "After select" })).toHaveFocus();
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("keeps mouse selection working and honors disabled", async () => {
		const onChange = vi.fn();
		const { rerender } = renderSelect({ onChange });
		const { user } = await openCombobox();
		await user.click(screen.getByRole("option", { name: "HORSE" }));
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenNthCalledWith(1, "HORSE");

		rerender(
			<VariantSelect disabled includeMix onChange={onChange} value="HORSE" />
		);
		expect(screen.getByRole("combobox")).toBeDisabled();
	});

	it("disables the input while master options are loading", () => {
		trpcMocks.gameVariantListQueryFn.mockReturnValue(
			new Promise(() => undefined)
		);

		renderSelect();

		expect(screen.getByRole("combobox")).toBeDisabled();
	});
});
