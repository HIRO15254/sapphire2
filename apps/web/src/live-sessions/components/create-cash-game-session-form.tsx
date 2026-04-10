import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

interface CreateCashGameSessionFormProps {
	currencies: Array<{ id: string; name: string }>;
	isLoading: boolean;
	onStoreChange?: (storeId?: string) => void;
	onSubmit: (values: {
		currencyId?: string;
		initialBuyIn: number;
		memo?: string;
		ringGameId: string;
		storeId: string;
	}) => void;
	ringGames: Array<{
		id: string;
		name: string;
		minBuyIn: number | null;
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
		setSelectedStoreId(value);
		setSelectedRingGameId(undefined);
		onStoreChange?.(value);
	};

	const handleRingGameChange = (value: string) => {
		setSelectedRingGameId(value);
		const ringGame = ringGames.find((g) => g.id === value);
		if (ringGame) {
			setInitialBuyIn(ringGame.maxBuyIn?.toString() ?? "");
			setSelectedCurrencyId(ringGame.currencyId ?? undefined);
		}
	};

	const handleCurrencyChange = (value: string) => {
		setSelectedCurrencyId(value);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!(selectedStoreId && selectedRingGameId)) {
			return;
		}
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
	const isCurrencyLocked =
		selectedRingGame?.currencyId !== null &&
		selectedRingGame?.currencyId !== undefined;

	const canSubmit = !!selectedStoreId && !!selectedRingGameId;

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field label="Store" required>
				{stores.length > 0 ? (
					<Select onValueChange={handleStoreChange} value={selectedStoreId}>
						<SelectTrigger>
							<SelectValue placeholder="Select a store" />
						</SelectTrigger>
						<SelectContent>
							{stores.map((store) => (
								<SelectItem key={store.id} value={store.id}>
									{store.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : (
					<EmptyState
						className="px-4 py-8"
						description="Create a store first."
						heading="No stores available"
					/>
				)}
			</Field>

			{selectedStoreId && (
				<Field label="Ring Game" required>
					{hasRingGames ? (
						<Select
							onValueChange={handleRingGameChange}
							value={selectedRingGameId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a ring game" />
							</SelectTrigger>
							<SelectContent>
								{ringGames.map((game) => (
									<SelectItem key={game.id} value={game.id}>
										{game.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<EmptyState
							className="px-4 py-8"
							description="Create one in store settings."
							heading="No ring games available"
						/>
					)}
				</Field>
			)}

			{selectedRingGameId && (
				<>
					{currencies.length > 0 && (
						<Field label="Currency">
							<Select
								disabled={isCurrencyLocked}
								onValueChange={handleCurrencyChange}
								value={selectedCurrencyId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a currency" />
								</SelectTrigger>
								<SelectContent>
									{currencies.map((currency) => (
										<SelectItem key={currency.id} value={currency.id}>
											{currency.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}

					<Field htmlFor="initialBuyIn" label="Initial Buy-in">
						<Input
							id="initialBuyIn"
							max={selectedRingGame?.maxBuyIn ?? undefined}
							min={selectedRingGame?.minBuyIn ?? 0}
							onChange={(e) => setInitialBuyIn(e.target.value)}
							required
							type="number"
							value={initialBuyIn}
						/>
					</Field>

					<Field htmlFor="memo" label="Memo">
						<Textarea
							id="memo"
							name="memo"
							placeholder="Notes about this session"
						/>
					</Field>
				</>
			)}

			<Button className="mt-2" disabled={isLoading || !canSubmit} type="submit">
				{isLoading ? "Starting..." : "Start Session"}
			</Button>
		</form>
	);
}
