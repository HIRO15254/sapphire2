import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
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
import type { UseSessionWizardReturn } from "../../use-session-wizard";
import { useVirtualResultFields } from "./use-virtual-result-fields";

/**
 * "Virtual" result section: free virtual buy-in / cash-out amounts plus
 * item-based usages (registered items spent or won). None of these amounts
 * touch currency balances — they only feed the virtual P/L analysis.
 */
export function VirtualResultFields({
	state,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	isLiveLinked: boolean;
}) {
	const { form, itemUsages, setItemUsages, selectedCurrencyId } = state;
	const { addRow, itemOptions, removeRow, updateRow } = useVirtualResultFields({
		itemUsages,
		selectedCurrencyId,
		setItemUsages,
	});

	return (
		<div className="flex flex-col gap-3">
			<h3 className="t-h4">Virtual</h3>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="virtualBuyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Virtual buy-in"
						>
							<Input
								disabled={isLiveLinked}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="virtualCashOut">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Virtual cash-out"
						>
							<Input
								disabled={isLiveLinked}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>

			{itemUsages.map((row) => (
				<div className="flex items-end gap-2" key={row.uid}>
					<Field
						className="flex-1"
						htmlFor={`item-usage-item-${row.uid}`}
						label="Item"
					>
						<Select
							disabled={isLiveLinked}
							onValueChange={(val) => updateRow(row.uid, { itemId: val })}
							value={row.itemId}
						>
							<SelectTrigger id={`item-usage-item-${row.uid}`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{itemOptions.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<ToggleGroup
						disabled={isLiveLinked}
						onValueChange={(val) => {
							if (val) {
								updateRow(row.uid, {
									direction: val as "buy_in" | "cash_out",
								});
							}
						}}
						type="single"
						value={row.direction}
					>
						<ToggleGroupItem value="buy_in">In</ToggleGroupItem>
						<ToggleGroupItem value="cash_out">Out</ToggleGroupItem>
					</ToggleGroup>
					<Field
						className="w-20"
						htmlFor={`item-usage-count-${row.uid}`}
						label="Count"
					>
						<Input
							disabled={isLiveLinked}
							id={`item-usage-count-${row.uid}`}
							inputMode="numeric"
							onChange={(e) => updateRow(row.uid, { count: e.target.value })}
							type="text"
							value={row.count}
						/>
					</Field>
					<Button
						aria-label="Remove item usage"
						disabled={isLiveLinked}
						onClick={() => removeRow(row.uid)}
						size="icon"
						type="button"
						variant="ghost"
					>
						<IconTrash size={16} />
					</Button>
				</div>
			))}

			{itemOptions.length > 0 ? (
				<Button
					className="self-start"
					disabled={isLiveLinked}
					onClick={addRow}
					size="sm"
					type="button"
					variant="outline"
				>
					<IconPlus size={16} />
					Add item usage
				</Button>
			) : null}
		</div>
	);
}
