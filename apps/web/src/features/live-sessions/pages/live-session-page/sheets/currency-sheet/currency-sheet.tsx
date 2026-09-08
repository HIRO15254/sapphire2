import { IconCheck, IconPlus, IconStarFilled } from "@tabler/icons-react";
import type { CurrencyLike } from "@/features/live-sessions/utils/session-settings";
import { currencySample } from "@/features/live-sessions/utils/session-settings";
import { cn } from "@/lib/utils";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { CrystSheet } from "../cryst-sheet";
import { useCurrencySheet } from "./use-currency-sheet";

const UNIT_MAX_LENGTH = 4;

const TEXT_INPUT_CLASS =
	"h-[var(--m-control)] min-w-0 rounded-md border border-input bg-background px-2.5 text-[length:var(--text-sm)] outline-none focus-visible:border-primary";

export interface CurrencyOption extends CurrencyLike {
	isFavorite: boolean;
}

interface CurrencySheetProps {
	currencies: readonly CurrencyOption[];
	isAddPending: boolean;
	onAdd: (values: { name: string; unit: string }) => Promise<unknown>;
	onOpenChange: (open: boolean) => void;
	onPick: (currencyId: string) => void;
	open: boolean;
	selectedCurrencyId: string | null;
}

export function CurrencySheet({
	currencies,
	isAddPending,
	onAdd,
	onOpenChange,
	onPick,
	open,
	selectedCurrencyId,
}: CurrencySheetProps) {
	const form = useCurrencySheet({ onAdd });

	return (
		<CrystSheet onOpenChange={onOpenChange} open={open} title="Currency">
			<div className="flex flex-col gap-2.5">
				<div className="flex flex-col overflow-hidden rounded-md border border-border">
					{currencies.map((currency, index) => {
						const isSelected = currency.id === selectedCurrencyId;
						return (
							<button
								className={cn(
									"flex min-h-[var(--m-list-row)] w-full items-center gap-2.5 px-3 py-2.5 text-left",
									index === currencies.length - 1
										? null
										: "border-border border-b",
									isSelected
										? "bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]"
										: "bg-transparent hover:bg-accent"
								)}
								key={currency.id}
								onClick={() => onPick(currency.id)}
								type="button"
							>
								<span
									className={cn(
										"inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono font-semibold text-[length:var(--text-sm)]",
										isSelected ? "text-primary" : "text-muted-foreground"
									)}
								>
									{currency.unit ?? "—"}
								</span>
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="truncate font-medium text-[length:var(--m-text-secondary)]">
										{currency.name}
									</span>
									<span className="text-[length:var(--m-text-caption)] text-muted-foreground">
										{currencySample(currency.unit)}
									</span>
								</span>
								{currency.isFavorite ? (
									<IconStarFilled className="shrink-0 text-warning" size={13} />
								) : null}
								{isSelected ? (
									<IconCheck className="shrink-0 text-primary" size={16} />
								) : null}
							</button>
						);
					})}
				</div>
				<div className="grid grid-cols-[1fr_auto] items-center gap-1.5">
					<div className="flex min-w-0 gap-1.5">
						<input
							aria-label="New currency name"
							{...NO_INPUT_SUGGESTIONS}
							className={cn(TEXT_INPUT_CLASS, "flex-1")}
							onChange={(e) => form.onNameChange(e.target.value)}
							placeholder="Name (e.g. Club chips)"
							type="text"
							value={form.name}
						/>
						<input
							aria-label="New currency unit"
							{...NO_INPUT_SUGGESTIONS}
							className={cn(TEXT_INPUT_CLASS, "w-[62px] font-mono")}
							maxLength={UNIT_MAX_LENGTH}
							onChange={(e) => form.onUnitChange(e.target.value)}
							placeholder="Unit"
							type="text"
							value={form.unit}
						/>
					</div>
					<button
						className="inline-flex min-h-[var(--m-control)] items-center gap-1.5 rounded-md border border-border px-3 font-medium text-[length:var(--text-sm)] disabled:opacity-50"
						disabled={isAddPending || !form.canSubmitNew}
						onClick={() => {
							form.onSubmitNew();
						}}
						type="button"
					>
						<IconPlus size={15} />
						Add
					</button>
				</div>
				<p className="text-[11px] text-muted-foreground">
					The unit is shown next to every amount in this session — chips, points
					and real money all read the same way. Changing it does not convert
					past amounts.
				</p>
			</div>
		</CrystSheet>
	);
}
