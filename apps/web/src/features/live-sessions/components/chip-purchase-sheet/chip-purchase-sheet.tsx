import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import type { ChipPurchaseFormOption } from "./use-chip-purchase-form";
import { useChipPurchaseForm } from "./use-chip-purchase-form";

interface ChipPurchaseSheetProps {
	initialOptionId?: string;
	onOpenChange: (open: boolean) => void;
	onSubmit: (purchase: { chipPurchaseOptionId: string }) => void;
	open: boolean;
	options: ChipPurchaseFormOption[];
}

export function ChipPurchaseSheet({
	open,
	onOpenChange,
	initialOptionId,
	onSubmit,
	options,
}: ChipPurchaseSheetProps) {
	const { form } = useChipPurchaseForm({
		initialOptionId,
		open,
		onSubmit: (values) => {
			onSubmit(values);
			onOpenChange(false);
		},
	});

	return (
		<ResponsiveDialog
			description="Select a chip purchase option for this session."
			onOpenChange={onOpenChange}
			open={open}
			title="Chip Purchase"
		>
			<form
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="chipPurchaseOptionId">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Purchase Option"
							required
						>
							<SelectWithClear
								onValueChange={(v) => field.handleChange(v ?? "")}
								value={field.state.value}
							>
								<SelectTrigger id={field.name}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{options.map((opt) => (
										<SelectItem key={opt.id} value={String(opt.id)}>
											{opt.name} — {opt.cost} / {opt.chips} chips
										</SelectItem>
									))}
								</SelectContent>
							</SelectWithClear>
						</Field>
					)}
				</form.Field>

				<DialogActionRow>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
					>
						{([canSubmit, isSubmitting]) => (
							<Button disabled={!canSubmit || isSubmitting} type="submit">
								Add Purchase
							</Button>
						)}
					</form.Subscribe>
				</DialogActionRow>
			</form>
		</ResponsiveDialog>
	);
}
