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

type SessionType = "cash_game" | "tournament";

interface SessionFormValues {
	addonCost?: number;
	bountyPrizes?: number;
	buyIn?: number;
	cashOut?: number;
	entryFee?: number;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	sessionDate: number;
	totalEntries?: number;
	tournamentBuyIn?: number;
	type: SessionType;
}

interface SessionFormProps {
	defaultValues?: Partial<SessionFormValues> & { type?: SessionType };
	disableTypeChange?: boolean;
	isLoading?: boolean;
	onSubmit: (values: SessionFormValues) => void;
}

function parseOptionalInt(value: string): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function parseRequiredInt(value: string, fallback: number): number {
	if (!value) {
		return fallback;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
}

function todayString(): string {
	const d = new Date();
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function dateToInputValue(timestamp: number | undefined): string {
	if (timestamp === undefined) {
		return todayString();
	}
	const d = new Date(timestamp);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function SessionForm({
	onSubmit,
	defaultValues,
	isLoading = false,
	disableTypeChange = false,
}: SessionFormProps) {
	const [sessionType, setSessionType] = useState<SessionType>(
		defaultValues?.type ?? "cash_game"
	);

	const isCashGame = sessionType === "cash_game";

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const sessionDateStr = formData.get("sessionDate") as string;
		const sessionDate = sessionDateStr
			? new Date(sessionDateStr).getTime()
			: Date.now();

		if (isCashGame) {
			onSubmit({
				type: "cash_game",
				sessionDate,
				buyIn: parseRequiredInt(formData.get("buyIn") as string, 0),
				cashOut: parseRequiredInt(formData.get("cashOut") as string, 0),
			});
		} else {
			onSubmit({
				type: "tournament",
				sessionDate,
				tournamentBuyIn: parseRequiredInt(
					formData.get("tournamentBuyIn") as string,
					0
				),
				entryFee: parseRequiredInt(formData.get("entryFee") as string, 0),
				placement: parseOptionalInt(formData.get("placement") as string),
				totalEntries: parseOptionalInt(formData.get("totalEntries") as string),
				prizeMoney: parseOptionalInt(formData.get("prizeMoney") as string),
				rebuyCount: parseOptionalInt(formData.get("rebuyCount") as string),
				rebuyCost: parseOptionalInt(formData.get("rebuyCost") as string),
				addonCost: parseOptionalInt(formData.get("addonCost") as string),
				bountyPrizes: parseOptionalInt(formData.get("bountyPrizes") as string),
			});
		}
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="type">
					Session Type <span className="text-destructive">*</span>
				</Label>
				<Select
					defaultValue={sessionType}
					disabled={disableTypeChange}
					name="type"
					onValueChange={(val) => setSessionType(val as SessionType)}
				>
					<SelectTrigger className="w-full" id="type">
						<SelectValue placeholder="Select type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="cash_game">Cash Game</SelectItem>
						<SelectItem value="tournament">Tournament</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="sessionDate">
					Date <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={dateToInputValue(defaultValues?.sessionDate)}
					id="sessionDate"
					name="sessionDate"
					required
					type="date"
				/>
			</div>

			{isCashGame ? (
				<div className="grid grid-cols-2 gap-3">
					<div className="flex flex-col gap-2">
						<Label htmlFor="buyIn">
							Buy-in <span className="text-destructive">*</span>
						</Label>
						<Input
							defaultValue={defaultValues?.buyIn}
							id="buyIn"
							inputMode="numeric"
							min={0}
							name="buyIn"
							placeholder="0"
							required
							type="number"
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="cashOut">
							Cash-out <span className="text-destructive">*</span>
						</Label>
						<Input
							defaultValue={defaultValues?.cashOut}
							id="cashOut"
							inputMode="numeric"
							min={0}
							name="cashOut"
							placeholder="0"
							required
							type="number"
						/>
					</div>
				</div>
			) : (
				<>
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="tournamentBuyIn">
								Buy-in <span className="text-destructive">*</span>
							</Label>
							<Input
								defaultValue={defaultValues?.tournamentBuyIn}
								id="tournamentBuyIn"
								inputMode="numeric"
								min={0}
								name="tournamentBuyIn"
								placeholder="0"
								required
								type="number"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="entryFee">
								Entry Fee <span className="text-destructive">*</span>
							</Label>
							<Input
								defaultValue={defaultValues?.entryFee}
								id="entryFee"
								inputMode="numeric"
								min={0}
								name="entryFee"
								placeholder="0"
								required
								type="number"
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="placement">Placement</Label>
							<Input
								defaultValue={defaultValues?.placement ?? undefined}
								id="placement"
								inputMode="numeric"
								min={1}
								name="placement"
								placeholder="e.g. 3"
								type="number"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="totalEntries">Total Entries</Label>
							<Input
								defaultValue={defaultValues?.totalEntries ?? undefined}
								id="totalEntries"
								inputMode="numeric"
								min={1}
								name="totalEntries"
								placeholder="e.g. 50"
								type="number"
							/>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="prizeMoney">Prize Money</Label>
						<Input
							defaultValue={defaultValues?.prizeMoney ?? undefined}
							id="prizeMoney"
							inputMode="numeric"
							min={0}
							name="prizeMoney"
							placeholder="0"
							type="number"
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="rebuyCount">Rebuy Count</Label>
							<Input
								defaultValue={defaultValues?.rebuyCount ?? undefined}
								id="rebuyCount"
								inputMode="numeric"
								min={0}
								name="rebuyCount"
								placeholder="0"
								type="number"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="rebuyCost">Rebuy Cost</Label>
							<Input
								defaultValue={defaultValues?.rebuyCost ?? undefined}
								id="rebuyCost"
								inputMode="numeric"
								min={0}
								name="rebuyCost"
								placeholder="0"
								type="number"
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="addonCost">Addon Cost</Label>
							<Input
								defaultValue={defaultValues?.addonCost ?? undefined}
								id="addonCost"
								inputMode="numeric"
								min={0}
								name="addonCost"
								placeholder="0"
								type="number"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="bountyPrizes">Bounty Prizes</Label>
							<Input
								defaultValue={defaultValues?.bountyPrizes ?? undefined}
								id="bountyPrizes"
								inputMode="numeric"
								min={0}
								name="bountyPrizes"
								placeholder="0"
								type="number"
							/>
						</div>
					</div>
				</>
			)}

			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
