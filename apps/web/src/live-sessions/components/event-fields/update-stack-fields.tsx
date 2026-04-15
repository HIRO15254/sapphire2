import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface UpdateStackFieldsProps {
	onStackAmountChange: (v: string) => void;
	stackAmount: string;
}

export function UpdateStackFields({
	onStackAmountChange,
	stackAmount,
}: UpdateStackFieldsProps) {
	return (
		<Field htmlFor="update-stack-amount" label="Stack Amount" required>
			<Input
				id="update-stack-amount"
				inputMode="numeric"
				min={0}
				onChange={(e) => onStackAmountChange(e.target.value)}
				required
				type="number"
				value={stackAmount}
			/>
		</Field>
	);
}
