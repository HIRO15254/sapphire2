import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface AddonFieldsProps {
	error?: string;
	onAmountChange: (value: string) => void;
	value: string;
}

export function AddonFields({
	error,
	onAmountChange,
	value,
}: AddonFieldsProps) {
	return (
		<Field error={error} htmlFor="addon-amount" label="Addon Amount" required>
			<Input
				id="addon-amount"
				inputMode="numeric"
				onChange={(e) => onAmountChange(e.target.value)}
				value={value}
			/>
		</Field>
	);
}
