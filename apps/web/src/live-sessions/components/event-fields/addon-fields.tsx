import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface AddonFieldsProps {
	amount: number;
	onAmountChange: (v: number) => void;
}

export function AddonFields({ amount, onAmountChange }: AddonFieldsProps) {
	return (
		<Field htmlFor="addon-amount" label="Addon Amount" required>
			<Input
				id="addon-amount"
				min={0}
				onChange={(e) => onAmountChange(Math.round(Number(e.target.value)))}
				required
				step={1}
				type="number"
				value={amount}
			/>
		</Field>
	);
}
