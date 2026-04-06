import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface CashGameCompleteFormProps {
	defaultFinalStack?: number;
	isLoading: boolean;
	onSubmit: (values: { finalStack: number }) => void;
}

export function CashGameCompleteForm({
	defaultFinalStack,
	isLoading,
	onSubmit,
}: CashGameCompleteFormProps) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const finalStack = Number(formData.get("finalStack"));

		onSubmit({ finalStack });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="finalStack" label="Final Stack" required>
				<Input
					defaultValue={defaultFinalStack ?? ""}
					id="finalStack"
					inputMode="numeric"
					min={0}
					name="finalStack"
					placeholder="0"
					required
					type="number"
				/>
			</Field>

			<DialogActionRow>
				<Button disabled={isLoading} type="submit">
					{isLoading ? "Completing..." : "Complete Session"}
				</Button>
			</DialogActionRow>
		</form>
	);
}
