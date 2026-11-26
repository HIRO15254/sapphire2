import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	masterGroups,
	masterVariants,
} from "@/features/games/__tests__/fixtures";
import type { StakeDraft } from "@/features/games/utils/stakes";
import { AnteTypeBulk } from "../ante-type-bulk";

const slot = { gameGroupId: "big-bet", name: null, variantIds: ["nlh"] };

function level(anteType: StakeDraft["anteType"], ante: string): StakeDraft[] {
	return [
		{ ...slot, ante, anteType, blind1: "100", blind2: "200", blind3: "" },
	];
}

describe("AnteTypeBulk", () => {
	it("shows Mixed across levels and applies one type to every level", () => {
		const onChange = vi.fn();
		const levels = [level("none", ""), null, level("bb", "200")];
		render(
			<AnteTypeBulk
				groups={masterGroups}
				levels={levels}
				onChange={onChange}
				slots={[slot]}
				variants={masterVariants}
			/>
		);
		const card = within(
			screen.getByRole("region", { name: "Big Bet ante type" })
		);

		expect(card.getByText("Mixed")).toBeInTheDocument();
		expect(card.getByRole("radio", { name: "BB" })).not.toBeChecked();

		fireEvent.click(card.getByRole("radio", { name: "BB" }));

		expect(onChange).toHaveBeenCalledWith([
			level("bb", ""),
			null,
			level("bb", "200"),
		]);
	});
});
