import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface UpdateStackFieldsProps {
	error?: string;
	onStackAmountChange: (value: string) => void;
	value: string;
}

export function UpdateStackFields({
	error,
	onStackAmountChange,
	value,
}: UpdateStackFieldsProps) {
	return (
		<Field
			error={error}
			htmlFor="update-stack-amount"
			label="Stack Amount"
			required
		>
			<Input
				id="update-stack-amount"
				inputMode="numeric"
				onChange={(e) => onStackAmountChange(e.target.value)}
				value={value}
			/>
		</Field>
	);
}
