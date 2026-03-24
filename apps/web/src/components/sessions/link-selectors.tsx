import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const NONE_VALUE = "__none__";

interface LinkSelectorsProps {
	currencies?: Array<{ id: string; name: string }>;
	gameLabel: string;
	gameOptions?: Array<{ id: string; name: string }>;
	onCurrencyChange: (id: string | undefined) => void;
	onGameChange: (id: string | undefined) => void;
	onStoreChange: (value: string) => void;
	selectedCurrencyId: string | undefined;
	selectedGameId: string | undefined;
	selectedStoreId: string | undefined;
	stores?: Array<{ id: string; name: string }>;
}

export function LinkSelectors({
	currencies,
	gameLabel,
	gameOptions,
	onCurrencyChange,
	onGameChange,
	onStoreChange,
	selectedCurrencyId,
	selectedGameId,
	selectedStoreId,
	stores,
}: LinkSelectorsProps) {
	return (
		<>
			{/* Store Selector */}
			{stores && stores.length > 0 && (
				<div className="flex flex-col gap-2">
					<Label>Store</Label>
					<Select
						onValueChange={onStoreChange}
						value={selectedStoreId ?? NONE_VALUE}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a store" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE_VALUE}>None</SelectItem>
							{stores.map((s) => (
								<SelectItem key={s.id} value={s.id}>
									{s.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{/* Game Selector */}
			{selectedStoreId && gameOptions && gameOptions.length > 0 && (
				<div className="flex flex-col gap-2">
					<Label>{gameLabel}</Label>
					<Select
						onValueChange={(v) =>
							onGameChange(v === NONE_VALUE ? undefined : v)
						}
						value={selectedGameId ?? NONE_VALUE}
					>
						<SelectTrigger>
							<SelectValue
								placeholder={`Select a ${gameLabel.toLowerCase()}`}
							/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE_VALUE}>None</SelectItem>
							{gameOptions.map((g) => (
								<SelectItem key={g.id} value={g.id}>
									{g.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						Selecting a game will pre-fill fields below.
					</p>
				</div>
			)}

			{/* Currency Selector */}
			{currencies && currencies.length > 0 && (
				<div className="flex flex-col gap-2">
					<Label>Currency</Label>
					<Select
						onValueChange={(v) =>
							onCurrencyChange(v === NONE_VALUE ? undefined : v)
						}
						value={selectedCurrencyId ?? NONE_VALUE}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a currency" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE_VALUE}>None</SelectItem>
							{currencies.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						Auto-generates a transaction with the session&apos;s P&L.
					</p>
				</div>
			)}
		</>
	);
}
