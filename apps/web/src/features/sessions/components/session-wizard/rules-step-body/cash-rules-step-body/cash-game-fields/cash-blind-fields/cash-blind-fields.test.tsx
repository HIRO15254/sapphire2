import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { useForm } from "@tanstack/react-form";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CashBlindFields } from "./cash-blind-fields";

const labelsFor = vi.fn((variant: string) => ({
	blind1: "Small bet",
	blind2: "Big bet",
	blind3: variant === "Limit Hold'em" ? null : "Bring-in",
}));

vi.mock("@/shared/hooks/use-variant-labels", () => ({
	useVariantLabels: (variant: string) => labelsFor(variant),
}));

function BlindFieldsHarness({
	isLiveLinked = false,
	variant = "Seven Card Stud",
}: {
	isLiveLinked?: boolean;
	variant?: string;
}) {
	const form = useForm({
		defaultValues: { blind1: "1", blind2: "2", blind3: "3" },
	});

	return (
		<CashBlindFields
			form={form}
			isLiveLinked={isLiveLinked}
			variant={variant}
		/>
	);
}

describe("CashBlindFields", () => {
	it("renders the third blind when the variant supplies its label", () => {
		render(<BlindFieldsHarness />);

		expect(screen.getByLabelText("Small bet")).toHaveValue("1");
		expect(screen.getByLabelText("Big bet")).toHaveValue("2");
		expect(screen.getByLabelText("Bring-in")).toHaveValue("3");
		expect(labelsFor).toHaveBeenCalledWith("Seven Card Stud");
	});

	it("omits the third blind when the variant has no third blind label", () => {
		render(<BlindFieldsHarness variant="Limit Hold'em" />);

		expect(screen.queryByLabelText("Bring-in")).not.toBeInTheDocument();
	});

	it("falls back to the default variant labels for an empty variant", () => {
		labelsFor.mockClear();

		render(<BlindFieldsHarness variant="" />);

		expect(labelsFor).toHaveBeenCalledTimes(1);
		expect(labelsFor).toHaveBeenCalledWith(DEFAULT_VARIANT_LABEL);
	});

	it("disables every blind input for a live-linked session", () => {
		render(<BlindFieldsHarness isLiveLinked />);

		expect(screen.getByLabelText("Small bet")).toBeDisabled();
		expect(screen.getByLabelText("Big bet")).toBeDisabled();
		expect(screen.getByLabelText("Bring-in")).toBeDisabled();
	});
});
