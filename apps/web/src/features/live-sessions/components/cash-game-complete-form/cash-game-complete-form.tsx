import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { formatNumber } from "@/utils/format-number";
import {
	type CashCompletePreviewInput,
	useCashGameCompleteForm,
} from "./use-cash-game-complete-form";

interface CashGameCompleteFormProps {
	defaultFinalStack?: number;
	formId: string;
	onSubmit: (values: { finalStack: number }) => void;
	previewInput?: CashCompletePreviewInput;
}

export function CashGameCompleteForm({
	defaultFinalStack,
	formId,
	onSubmit,
	previewInput,
}: CashGameCompleteFormProps) {
	const { form, preview } = useCashGameCompleteForm({
		defaultFinalStack,
		onSubmit,
		previewInput,
	});

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="finalStack">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Final Stack"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			{preview ? (
				<div className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2.5 text-xs">
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">Total buy-in</span>
						<span className="font-mono">
							{formatNumber(preview.totalBuyIn)}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">Total withdrawn</span>
						<span className="font-mono">
							{formatNumber(preview.totalWithdrawn)}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">Result</span>
						<span
							className={cn(
								"font-mono",
								preview.result >= 0 ? "text-success" : "text-destructive"
							)}
						>
							{preview.result >= 0 ? "+" : ""}
							{formatNumber(preview.result)}
						</span>
					</div>
					{preview.evResult === null ? null : (
						<div className="mt-1 flex items-center justify-between border-border border-t pt-1">
							<span className="text-muted-foreground">EV result</span>
							<span className="font-mono">
								{preview.evResult >= 0 ? "+" : ""}
								{formatNumber(preview.evResult)}
							</span>
						</div>
					)}
				</div>
			) : null}
		</form>
	);
}
