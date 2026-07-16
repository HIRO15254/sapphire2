import type {
	VirtualAmountItemOption,
	VirtualAmountPayload,
} from "@/features/live-sessions/utils/virtual-amount";
import { FormSheet } from "@/shared/components/form-sheet";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import { useVirtualAmountForm } from "./use-virtual-amount-form";

interface VirtualAmountSheetProps {
	formId: string;
	items: VirtualAmountItemOption[];
	onOpenChange: (open: boolean) => void;
	onSubmit: (payload: VirtualAmountPayload) => void;
	open: boolean;
	title: string;
}

/**
 * Shared form sheet for recording a virtual buy-in or cash-out on a live
 * session: either N registered items (valued at their frozen unit value) or a
 * free currency-equivalent amount. Neither touches currency balances.
 */
export function VirtualAmountSheet({
	formId,
	items,
	onOpenChange,
	onSubmit,
	open,
	title,
}: VirtualAmountSheetProps) {
	const { form, hasItems } = useVirtualAmountForm({ items, open, onSubmit });

	return (
		<FormSheet
			formId={formId}
			onOpenChange={onOpenChange}
			open={open}
			title={title}
		>
			<form
				className="flex flex-col gap-4"
				id={formId}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="mode">
					{(field) => (
						<Field htmlFor={`${formId}-mode`} label="Record as">
							<ToggleGroup
								onValueChange={(val) => {
									if (val) {
										field.handleChange(val as "item" | "amount");
									}
								}}
								type="single"
								value={field.state.value}
							>
								<ToggleGroupItem disabled={!hasItems} value="item">
									Item
								</ToggleGroupItem>
								<ToggleGroupItem value="amount">Amount</ToggleGroupItem>
							</ToggleGroup>
						</Field>
					)}
				</form.Field>

				<form.Subscribe selector={(state) => state.values.mode}>
					{(mode) =>
						mode === "item" ? (
							<>
								<form.Field name="itemId">
									{(field) => (
										<Field
											error={field.state.meta.errors[0]?.message}
											htmlFor={`${formId}-item`}
											label="Item"
											required
										>
											<Select
												onValueChange={(val) => field.handleChange(val)}
												value={field.state.value}
											>
												<SelectTrigger id={`${formId}-item`}>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{items.map((item) => (
														<SelectItem key={item.id} value={item.id}>
															{item.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</Field>
									)}
								</form.Field>
								<form.Field name="count">
									{(field) => (
										<Field
											error={field.state.meta.errors[0]?.message}
											htmlFor={`${formId}-count`}
											label="Count"
											required
										>
											<Input
												id={`${formId}-count`}
												inputMode="numeric"
												onChange={(e) => field.handleChange(e.target.value)}
												type="text"
												value={field.state.value}
											/>
										</Field>
									)}
								</form.Field>
							</>
						) : (
							<form.Field name="amount">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={`${formId}-amount`}
										label="Amount"
										required
									>
										<Input
											id={`${formId}-amount`}
											inputMode="numeric"
											onChange={(e) => field.handleChange(e.target.value)}
											type="text"
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>
						)
					}
				</form.Subscribe>
			</form>
		</FormSheet>
	);
}
