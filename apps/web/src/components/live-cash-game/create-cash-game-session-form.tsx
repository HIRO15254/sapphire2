import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const NONE_VALUE = "__none__";

interface CreateCashGameSessionFormProps {
	currencies: Array<{ id: string; name: string }>;
	isLoading: boolean;
	onStoreChange?: (storeId?: string) => void;
	onSubmit: (values: {
		currencyId?: string;
		initialBuyIn: number;
		memo?: string;
		ringGameId?: string;
		storeId?: string;
	}) => void;
	ringGames: Array<{
		id: string;
		name: string;
		maxBuyIn: number | null;
		currencyId: string | null;
	}>;
	stores: Array<{ id: string; name: string }>;
}

export function CreateCashGameSessionForm({
	currencies,
	isLoading,
	onStoreChange,
	onSubmit,
	ringGames,
	stores,
}: CreateCashGameSessionFormProps) {
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		undefined
	);
	const [selectedRingGameId, setSelectedRingGameId] = useState<
		string | undefined
	>(undefined);
	const [selectedCurrencyId, setSelectedCurrencyId] = useState<
		string | undefined
	>(undefined);
	const [initialBuyIn, setInitialBuyIn] = useState<string>("");

	const handleStoreChange = (value: string) => {
		const storeId = value === NONE_VALUE ? undefined : value;
		setSelectedStoreId(storeId);
		setSelectedRingGameId(undefined);
		onStoreChange?.(storeId);
	};

	const handleRingGameChange = (value: string) => {
		const ringGameId = value === NONE_VALUE ? undefined : value;
		setSelectedRingGameId(ringGameId);

		if (ringGameId) {
			const ringGame = ringGames.find((g) => g.id === ringGameId);
			if (ringGame) {
				setInitialBuyIn(ringGame.maxBuyIn?.toString() ?? "");
				setSelectedCurrencyId(ringGame.currencyId ?? undefined);
			}
		}
	};

	const handleCurrencyChange = (value: string) => {
		setSelectedCurrencyId(value === NONE_VALUE ? undefined : value);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const memo = (formData.get("memo") as string) || undefined;

		onSubmit({
			storeId: selectedStoreId,
			ringGameId: selectedRingGameId,
			currencyId: selectedCurrencyId,
			initialBuyIn: Number(initialBuyIn),
			memo,
		});
	};

	const hasRingGames = ringGames.length > 0;

	// Determine which fields are locked by the selected ring game
	const selectedRingGame = selectedRingGameId
		? ringGames.find((g) => g.id === selectedRingGameId)
		: null;
	const isBuyInLocked =
		selectedRingGame?.maxBuyIn !== null &&
		selectedRingGame?.maxBuyIn !== undefined;
	const isCurrencyLocked =
		selectedRingGame?.currencyId !== null &&
		selectedRingGame?.currencyId !== undefined;

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			{stores.length > 0 && (
				<div className="flex flex-col gap-2">
					<Label>Store</Label>
					<Select
						onValueChange={handleStoreChange}
						value={selectedStoreId ?? NONE_VALUE}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a store" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE_VALUE}>None</SelectItem>
							{stores.map((store) => (
								<SelectItem key={store.id} value={store.id}>
									{store.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{selectedStoreId && (
				<div className="flex flex-col gap-2">
					<Label>Ring Game</Label>
					{hasRingGames ? (
						<Select
							onValueChange={handleRingGameChange}
							value={selectedRingGameId ?? NONE_VALUE}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a ring game" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>None</SelectItem>
								{ringGames.map((game) => (
									<SelectItem key={game.id} value={game.id}>
										{game.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<Select disabled>
							<SelectTrigger>
								<SelectValue placeholder="No ring games available" />
							</SelectTrigger>
						</Select>
					)}
				</div>
			)}

			{currencies.length > 0 && (
				<div className="flex flex-col gap-2">
					<Label>Currency</Label>
					<Select
						disabled={isCurrencyLocked}
						onValueChange={handleCurrencyChange}
						value={selectedCurrencyId ?? NONE_VALUE}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a currency" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE_VALUE}>None</SelectItem>
							{currencies.map((currency) => (
								<SelectItem key={currency.id} value={currency.id}>
									{currency.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="flex flex-col gap-2">
				<Label htmlFor="initialBuyIn">Initial Buy-in</Label>
				<Input
					disabled={isBuyInLocked}
					id="initialBuyIn"
					min={0}
					onChange={(e) => setInitialBuyIn(e.target.value)}
					required
					type="number"
					value={initialBuyIn}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="memo">Memo</Label>
				<textarea
					className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					id="memo"
					name="memo"
					placeholder="Notes about this session"
				/>
			</div>

			<Button className="mt-2" disabled={isLoading} type="submit">
				{isLoading ? "Starting..." : "Start Session"}
			</Button>
		</form>
	);
}
