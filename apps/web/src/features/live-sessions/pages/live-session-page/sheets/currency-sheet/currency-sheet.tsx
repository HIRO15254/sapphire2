import { IconCoinOff, IconStarFilled } from "@tabler/icons-react";
import { formatWithUnit } from "@/features/live-sessions/utils/session-settings";
import { SearchPicker, SearchPickerRow } from "../../search-picker";
import { CrystSheet } from "../cryst-sheet";
import type { CurrencyOption } from "./use-currency-sheet";
import { useCurrencySheet } from "./use-currency-sheet";

interface CurrencySheetProps {
	currencies: readonly CurrencyOption[];
	onOpenChange: (open: boolean) => void;
	onPick: (currencyId: string) => void;
	open: boolean;
	selectedCurrencyId: string | null;
}

export function CurrencySheet({
	currencies,
	onOpenChange,
	onPick,
	open,
	selectedCurrencyId,
}: CurrencySheetProps) {
	const sheet = useCurrencySheet({ currencies, open });

	return (
		<CrystSheet onOpenChange={onOpenChange} open={open} title="Currency">
			<SearchPicker
				emptyIcon={IconCoinOff}
				emptyLabel="No currency matches"
				isEmpty={sheet.matched.length === 0}
				onQueryChange={sheet.onQueryChange}
				query={sheet.query}
				searchLabel="Search currencies"
			>
				{sheet.matched.map((currency) => (
					<SearchPickerRow
						isPicked={currency.id === selectedCurrencyId}
						key={currency.id}
						onClick={() => onPick(currency.id)}
					>
						<span className="flex min-w-0 flex-1 flex-col gap-0.5">
							<span className="truncate font-medium text-[length:var(--m-text-secondary)] leading-[1.3]">
								{currency.name}
							</span>
							<span className="truncate text-[length:var(--m-text-caption)] text-muted-foreground leading-[1.35]">
								{formatWithUnit(currency.balance, currency.unit)}
							</span>
						</span>
						{currency.isFavorite ? (
							<IconStarFilled className="shrink-0 text-warning" size={13} />
						) : null}
					</SearchPickerRow>
				))}
			</SearchPicker>
		</CrystSheet>
	);
}
