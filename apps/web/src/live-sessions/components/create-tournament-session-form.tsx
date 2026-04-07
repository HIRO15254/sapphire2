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

interface CreateTournamentSessionFormProps {
	currencies: Array<{ id: string; name: string }>;
	isLoading: boolean;
	onStoreChange?: (storeId?: string) => void;
	onSubmit: (values: {
		buyIn: number;
		currencyId?: string;
		entryFee?: number;
		memo?: string;
		startingStack: number;
		storeId: string;
		tournamentId: string;
	}) => void;
	stores: Array<{ id: string; name: string }>;
	tournaments: Array<{
		id: string;
		name: string;
		buyIn: number | null;
		entryFee: number | null;
		startingStack: number | null;
		currencyId: string | null;
	}>;
}

export function CreateTournamentSessionForm({
	currencies,
	isLoading,
	onStoreChange,
	onSubmit,
	stores,
	tournaments,
}: CreateTournamentSessionFormProps) {
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		undefined
	);
	const [selectedTournamentId, setSelectedTournamentId] = useState<
		string | undefined
	>(undefined);
	const [selectedCurrencyId, setSelectedCurrencyId] = useState<
		string | undefined
	>(undefined);
	const [buyIn, setBuyIn] = useState<string>("");
	const [entryFee, setEntryFee] = useState<string>("");
	const [startingStack, setStartingStack] = useState<string>("");

	const handleStoreChange = (value: string) => {
		setSelectedStoreId(value);
		setSelectedTournamentId(undefined);
		onStoreChange?.(value);
	};

	const applyTournamentDefaults = (t: (typeof tournaments)[number]) => {
		if (t.currencyId) {
			setSelectedCurrencyId(t.currencyId);
		}
		if (t.buyIn !== null) {
			setBuyIn(String(t.buyIn));
		}
		if (t.entryFee !== null) {
			setEntryFee(String(t.entryFee));
		}
		if (t.startingStack !== null) {
			setStartingStack(String(t.startingStack));
		}
	};

	const handleTournamentChange = (value: string) => {
		setSelectedTournamentId(value);
		const t = tournaments.find((t) => t.id === value);
		if (t) {
			applyTournamentDefaults(t);
		}
	};

	const handleCurrencyChange = (value: string) => {
		setSelectedCurrencyId(value);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!(selectedStoreId && selectedTournamentId)) {
			return;
		}
		const formData = new FormData(e.currentTarget);
		const memo = (formData.get("memo") as string) || undefined;
		const entryFeeNum = entryFee ? Number(entryFee) : undefined;

		onSubmit({
			storeId: selectedStoreId,
			tournamentId: selectedTournamentId,
			currencyId: selectedCurrencyId,
			buyIn: Number(buyIn),
			entryFee: entryFeeNum,
			startingStack: Number(startingStack),
			memo,
		});
	};

	const hasTournaments = tournaments.length > 0;

	// Determine which fields are locked by the selected tournament
	const selectedTournament = selectedTournamentId
		? tournaments.find((t) => t.id === selectedTournamentId)
		: null;
	const isBuyInLocked =
		selectedTournament?.buyIn !== null &&
		selectedTournament?.buyIn !== undefined;
	const isEntryFeeLocked =
		selectedTournament?.entryFee !== null &&
		selectedTournament?.entryFee !== undefined;
	const isStartingStackLocked =
		selectedTournament?.startingStack !== null &&
		selectedTournament?.startingStack !== undefined;
	const isCurrencyLocked =
		selectedTournament?.currencyId !== null &&
		selectedTournament?.currencyId !== undefined;

	const canSubmit = !!selectedStoreId && !!selectedTournamentId;

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
				<Field label="Tournament" required>
					{hasTournaments ? (
						<Select
							onValueChange={handleTournamentChange}
							value={selectedTournamentId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a tournament" />
							</SelectTrigger>
							<SelectContent>
								{tournaments.map((t) => (
									<SelectItem key={t.id} value={t.id}>
										{t.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<EmptyState
							className="px-4 py-8"
							description="Create one in store settings."
							heading="No tournaments available"
						/>
					)}
				</Field>
			)}

			{selectedTournamentId && (
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

					<div className="flex gap-3">
						<Field className="flex-1" htmlFor="buyIn" label="Buy-in" required>
							<Input
								disabled={isBuyInLocked}
								id="buyIn"
								inputMode="numeric"
								min={0}
								onChange={(e) => setBuyIn(e.target.value)}
								required
								type="number"
								value={buyIn}
							/>
						</Field>
						<Field className="flex-1" htmlFor="entryFee" label="Entry Fee">
							<Input
								disabled={isEntryFeeLocked}
								id="entryFee"
								inputMode="numeric"
								min={0}
								onChange={(e) => setEntryFee(e.target.value)}
								type="number"
								value={entryFee}
							/>
						</Field>
					</div>

					<Field htmlFor="startingStack" label="Starting Stack" required>
						<Input
							disabled={isStartingStackLocked}
							id="startingStack"
							inputMode="numeric"
							min={0}
							onChange={(e) => setStartingStack(e.target.value)}
							required
							type="number"
							value={startingStack}
						/>
					</Field>

					<Field htmlFor="memo" label="Memo">
						<Textarea
							id="memo"
							name="memo"
							placeholder="Notes about this tournament"
						/>
					</Field>
				</>
			)}

			<Button className="mt-2" disabled={isLoading || !canSubmit} type="submit">
				{isLoading ? "Starting..." : "Start Tournament"}
			</Button>
		</form>
	);
}
