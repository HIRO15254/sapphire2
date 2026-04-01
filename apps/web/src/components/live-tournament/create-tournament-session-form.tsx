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
		storeId?: string;
		tournamentId?: string;
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
		const storeId = value === NONE_VALUE ? undefined : value;
		setSelectedStoreId(storeId);
		setSelectedTournamentId(undefined);
		onStoreChange?.(storeId);
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
		const tournamentId = value === NONE_VALUE ? undefined : value;
		setSelectedTournamentId(tournamentId);

		if (tournamentId) {
			const t = tournaments.find((t) => t.id === tournamentId);
			if (t) {
				applyTournamentDefaults(t);
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
					<Label>Tournament</Label>
					{hasTournaments ? (
						<Select
							onValueChange={handleTournamentChange}
							value={selectedTournamentId ?? NONE_VALUE}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a tournament" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>None</SelectItem>
								{tournaments.map((t) => (
									<SelectItem key={t.id} value={t.id}>
										{t.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<Select disabled>
							<SelectTrigger>
								<SelectValue placeholder="No tournaments available" />
							</SelectTrigger>
						</Select>
					)}
				</div>
			)}

			{currencies.length > 0 && (
				<div className="flex flex-col gap-2">
					<Label>Currency</Label>
					<Select
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

			<div className="flex gap-3">
				<div className="flex flex-1 flex-col gap-2">
					<Label htmlFor="buyIn">
						Buy-in <span className="text-destructive">*</span>
					</Label>
					<Input
						id="buyIn"
						inputMode="numeric"
						min={0}
						onChange={(e) => setBuyIn(e.target.value)}
						required
						type="number"
						value={buyIn}
					/>
				</div>
				<div className="flex flex-1 flex-col gap-2">
					<Label htmlFor="entryFee">Entry Fee</Label>
					<Input
						id="entryFee"
						inputMode="numeric"
						min={0}
						onChange={(e) => setEntryFee(e.target.value)}
						type="number"
						value={entryFee}
					/>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="startingStack">
					Starting Stack <span className="text-destructive">*</span>
				</Label>
				<Input
					id="startingStack"
					inputMode="numeric"
					min={0}
					onChange={(e) => setStartingStack(e.target.value)}
					required
					type="number"
					value={startingStack}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="memo">Memo</Label>
				<textarea
					className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					id="memo"
					name="memo"
					placeholder="Notes about this tournament"
				/>
			</div>

			<Button className="mt-2" disabled={isLoading} type="submit">
				{isLoading ? "Starting..." : "Start Tournament"}
			</Button>
		</form>
	);
}
