import { fireEvent, render, screen, within } from "@testing-library/react";
import { useCallback, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	masterGroups,
	masterVariants,
} from "@/features/games/__tests__/fixtures";
import type { StakeDraft } from "@/features/games/utils/stakes";
import { StakesFields } from "../stakes-fields";

function stake(gameGroupId: string, variantIds: string[]): StakeDraft {
	return {
		ante: "",
		anteType: null,
		blind1: "",
		blind2: "",
		blind3: "",
		gameGroupId,
		name: null,
		variantIds,
	};
}

function Harness({
	checkRequired = false,
	initial,
	onChange,
}: {
	checkRequired?: boolean;
	initial: StakeDraft[];
	onChange?: (next: StakeDraft[]) => void;
}) {
	const [value, setValue] = useState(initial);
	const handleChange = useCallback(
		(next: StakeDraft[]) => {
			setValue(next);
			onChange?.(next);
		},
		[onChange]
	);
	return (
		<StakesFields
			checkRequired={checkRequired}
			groups={masterGroups}
			onChange={handleChange}
			value={value}
			variants={masterVariants}
		/>
	);
}

describe("StakesFields", () => {
	it("marks an invalid amount on its own field and requires blinds only when asked", () => {
		const initial = [stake("big-bet", ["nlh", "plo"])];
		const { rerender } = render(<Harness initial={initial} />);
		const card = within(screen.getByRole("region", { name: "Big Bet stakes" }));

		fireEvent.change(card.getByLabelText("SB *"), { target: { value: "1.5" } });

		expect(card.getByLabelText("SB *")).toHaveAttribute("aria-invalid", "true");
		expect(card.getByRole("alert")).toHaveTextContent("Whole numbers only");
		expect(card.getByLabelText("BB *")).not.toHaveAttribute("aria-invalid");

		rerender(<Harness checkRequired initial={initial} />);

		expect(card.getByText("Enter the BB")).toBeInTheDocument();
	});

	it("enables the ante amount only for a paying type and clears it for None", () => {
		const onChange = vi.fn();
		render(
			<Harness initial={[stake("big-bet", ["nlh"])]} onChange={onChange} />
		);
		const amount = screen.getByRole("textbox", {
			name: "Ante amount for Big Bet",
		});

		expect(amount).toBeDisabled();

		fireEvent.click(screen.getByRole("radio", { name: "BB" }));
		fireEvent.change(amount, { target: { value: "200" } });

		expect(amount).toBeEnabled();
		expect(onChange).toHaveBeenLastCalledWith([
			expect.objectContaining({ ante: "200", anteType: "bb" }),
		]);

		fireEvent.click(screen.getByRole("radio", { name: "None" }));

		expect(amount).toBeDisabled();
		expect(amount).toHaveValue("");
		expect(onChange).toHaveBeenLastCalledWith([
			expect.objectContaining({ ante: "", anteType: "none" }),
		]);
	});

	it("locks the ante type a structure fixes", () => {
		render(<Harness initial={[stake("stud", ["razz"])]} />);
		const card = within(screen.getByRole("region", { name: "Stud stakes" }));

		expect(card.getByRole("radio", { name: "All" })).toBeChecked();
		expect(card.getByRole("radio", { name: "None" })).toBeDisabled();
		expect(card.getByText("Set by the structure.")).toBeInTheDocument();
		expect(
			card.getByRole("textbox", { name: "Ante amount for Stud" })
		).toBeEnabled();
	});
});
