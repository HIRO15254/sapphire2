import { useForm } from "@tanstack/react-form";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashGameFields } from "./cash-game-fields";

vi.mock("@/shared/components/variant-select", () => ({
	VariantSelect: ({
		disabled,
		id,
		value,
	}: {
		disabled: boolean;
		id: string;
		value: string;
	}) => (
		<input
			aria-label="Variant"
			disabled={disabled}
			id={id}
			readOnly
			value={value}
		/>
	),
}));

vi.mock("@/shared/hooks/use-variant-labels", () => ({
	useVariantLabels: () => ({ blind1: "SB", blind2: "BB", blind3: "Straddle" }),
}));

function CashGameFieldsHarness({
	anteType = "none",
	currencies,
	isLiveLinked = false,
	isMixValue = () => false,
	onCurrencyChange,
	variant = "NL Hold'em",
}: {
	anteType?: "all" | "bb" | "none";
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked?: boolean;
	isMixValue?: (value: string) => boolean;
	onCurrencyChange?: (id: string | undefined) => void;
	variant?: string;
}) {
	const form = useForm({
		defaultValues: {
			ante: "1",
			anteType,
			blind1: "1",
			blind2: "2",
			blind3: "4",
			tableSize: "9",
			variant,
		},
	});

	return (
		<CashGameFields
			currencies={currencies}
			form={form}
			isLiveLinked={isLiveLinked}
			isMixValue={isMixValue}
			onCurrencyChange={onCurrencyChange}
			onVariantChange={vi.fn()}
		/>
	);
}

describe("CashGameFields", () => {
	it("shows a selectable currency only when currencies are available", async () => {
		const user = userEvent.setup();
		const onCurrencyChange = vi.fn();
		render(
			<CashGameFieldsHarness
				currencies={[{ id: "jpy", name: "JPY" }]}
				onCurrencyChange={onCurrencyChange}
			/>
		);

		await user.click(screen.getAllByRole("combobox")[0]);
		await user.click(screen.getByRole("option", { name: "JPY" }));
		expect(onCurrencyChange).toHaveBeenCalledTimes(1);
		expect(onCurrencyChange).toHaveBeenNthCalledWith(1, "jpy");

		const { unmount } = render(<CashGameFieldsHarness currencies={[]} />);
		expect(screen.queryAllByText("Currency")).toHaveLength(1);
		unmount();
	});

	it("hides flat blind and ante fields for a mix while retaining table size", () => {
		render(<CashGameFieldsHarness isMixValue={() => true} variant="HORSE" />);

		expect(screen.queryByLabelText("SB")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Ante")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Table size")).toBeInTheDocument();
	});

	it("disables ante while no ante is selected and enables it for a BB ante", () => {
		const { rerender } = render(<CashGameFieldsHarness />);
		expect(screen.getByLabelText("Ante")).toBeDisabled();

		rerender(<CashGameFieldsHarness anteType="bb" />);
		expect(screen.getByLabelText("Ante")).not.toBeDisabled();
	});

	it("locks variant, blinds, ante, and table size when live-linked", () => {
		render(<CashGameFieldsHarness anteType="bb" isLiveLinked />);

		expect(screen.getByLabelText("Variant")).toBeDisabled();
		expect(screen.getByLabelText("SB")).toBeDisabled();
		expect(screen.getByLabelText("BB")).toBeDisabled();
		expect(screen.getByLabelText("Straddle")).toBeDisabled();
		expect(screen.getByLabelText("Ante")).toBeDisabled();
		expect(screen.getByLabelText("Table size")).toBeDisabled();
	});

	it("offers all table sizes from 2-max through 10-max", async () => {
		const user = userEvent.setup();
		render(<CashGameFieldsHarness />);

		await user.click(screen.getByLabelText("Table size"));
		expect(screen.getByRole("option", { name: "2-max" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "10-max" })).toBeInTheDocument();
		fireEvent.keyDown(screen.getByLabelText("Table size"), { key: "Escape" });
	});
});
