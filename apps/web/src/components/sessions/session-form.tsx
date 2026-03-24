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
import { TagInput } from "@/components/ui/tag-input";

interface CashGameFormValues {
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	buyIn: number;
	cashOut: number;
	endTime?: string;
	memo?: string;
	sessionDate: string;
	startTime?: string;
	tableSize?: number;
	tagIds?: string[];
	type: "cash_game";
	variant: string;
}

interface TournamentFormValues {
	addonCost?: number;
	bountyPrizes?: number;
	endTime?: string;
	entryFee?: number;
	memo?: string;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	sessionDate: string;
	startTime?: string;
	tagIds?: string[];
	totalEntries?: number;
	tournamentBuyIn: number;
	type: "tournament";
}

type SessionFormValues = CashGameFormValues | TournamentFormValues;

interface SessionFormDefaults {
	addonCost?: number;
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	bountyPrizes?: number;
	buyIn?: number;
	cashOut?: number;
	endTime?: string;
	entryFee?: number;
	memo?: string;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	sessionDate?: string;
	startTime?: string;
	tableSize?: number;
	tagIds?: string[];
	totalEntries?: number;
	tournamentBuyIn?: number;
	type?: "cash_game" | "tournament";
	variant?: string;
}

interface SessionFormProps {
	defaultValues?: SessionFormDefaults;
	isLoading?: boolean;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onSubmit: (values: SessionFormValues) => void;
	tags?: Array<{ id: string; name: string }>;
}

const ANTE_TYPES = [
	{ value: "none", label: "No Ante" },
	{ value: "bb", label: "BB Ante" },
	{ value: "all", label: "All Ante" },
] as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function getTodayDateString(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseOptionalInt(value: string): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

export function SessionForm({
	defaultValues,
	isLoading = false,
	onCreateTag,
	onSubmit,
	tags,
}: SessionFormProps) {
	const [sessionType, setSessionType] = useState<"cash_game" | "tournament">(
		defaultValues?.type ?? "cash_game"
	);
	const [anteType, setAnteType] = useState<string>(
		defaultValues?.anteType ?? "none"
	);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
		defaultValues?.tagIds ?? []
	);

	const isAnteDisabled = anteType === "none";
	const isCashGame = sessionType === "cash_game";

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const common = {
			sessionDate: formData.get("sessionDate") as string,
			startTime: (formData.get("startTime") as string) || undefined,
			endTime: (formData.get("endTime") as string) || undefined,
			tagIds: selectedTagIds,
			memo: (formData.get("memo") as string) || undefined,
		};

		if (isCashGame) {
			const values: CashGameFormValues = {
				...common,
				type: "cash_game",
				buyIn: Number(formData.get("buyIn")),
				cashOut: Number(formData.get("cashOut")),
				variant: (formData.get("variant") as string) || "nlh",
				blind1: parseOptionalInt(formData.get("blind1") as string),
				blind2: parseOptionalInt(formData.get("blind2") as string),
				blind3: parseOptionalInt(formData.get("blind3") as string),
				ante: isAnteDisabled
					? undefined
					: parseOptionalInt(formData.get("ante") as string),
				anteType: (formData.get("anteType") as string) || undefined,
				tableSize: parseOptionalInt(formData.get("tableSize") as string),
			};
			onSubmit(values);
		} else {
			const values: TournamentFormValues = {
				...common,
				type: "tournament",
				tournamentBuyIn: Number(formData.get("tournamentBuyIn")),
				entryFee: parseOptionalInt(formData.get("entryFee") as string),
				placement: parseOptionalInt(formData.get("placement") as string),
				totalEntries: parseOptionalInt(formData.get("totalEntries") as string),
				prizeMoney: parseOptionalInt(formData.get("prizeMoney") as string),
				rebuyCount: parseOptionalInt(formData.get("rebuyCount") as string),
				rebuyCost: parseOptionalInt(formData.get("rebuyCost") as string),
				addonCost: parseOptionalInt(formData.get("addonCost") as string),
				bountyPrizes: parseOptionalInt(formData.get("bountyPrizes") as string),
			};
			onSubmit(values);
		}
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			{/* Session Type */}
			<div className="flex flex-col gap-2">
				<Label>Session Type</Label>
				<div className="grid grid-cols-2 gap-2">
					<Button
						className={
							isCashGame
								? ""
								: "border-transparent bg-transparent text-muted-foreground"
						}
						onClick={() => setSessionType("cash_game")}
						type="button"
						variant={isCashGame ? "default" : "outline"}
					>
						Cash Game
					</Button>
					<Button
						className={
							isCashGame
								? "border-transparent bg-transparent text-muted-foreground"
								: ""
						}
						onClick={() => setSessionType("tournament")}
						type="button"
						variant={isCashGame ? "outline" : "default"}
					>
						Tournament
					</Button>
				</div>
			</div>

			{/* Session Date */}
			<div className="flex flex-col gap-2">
				<Label htmlFor="sessionDate">
					Session Date <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.sessionDate ?? getTodayDateString()}
					id="sessionDate"
					name="sessionDate"
					required
					type="date"
				/>
			</div>

			{/* Start Time / End Time */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="startTime">Start Time</Label>
					<Input
						defaultValue={defaultValues?.startTime}
						id="startTime"
						name="startTime"
						type="time"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="endTime">End Time</Label>
					<Input
						defaultValue={defaultValues?.endTime}
						id="endTime"
						name="endTime"
						type="time"
					/>
				</div>
			</div>

			{isCashGame ? (
				<>
					{/* Buy-in / Cash-out */}
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

					{/* Variant */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="variant">Variant</Label>
						<Select
							defaultValue={defaultValues?.variant ?? "nlh"}
							name="variant"
						>
							<SelectTrigger className="w-full" id="variant">
								<SelectValue placeholder="Select variant" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="nlh">NL Hold&apos;em</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* SB / BB / Straddle */}
					<div className="grid grid-cols-3 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="blind1">SB</Label>
							<Input
								defaultValue={defaultValues?.blind1}
								id="blind1"
								inputMode="numeric"
								min={0}
								name="blind1"
								placeholder="0"
								type="number"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="blind2">BB</Label>
							<Input
								defaultValue={defaultValues?.blind2}
								id="blind2"
								inputMode="numeric"
								min={0}
								name="blind2"
								placeholder="0"
								type="number"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="blind3">Straddle</Label>
							<Input
								defaultValue={defaultValues?.blind3}
								id="blind3"
								inputMode="numeric"
								min={0}
								name="blind3"
								placeholder="0"
								type="number"
							/>
						</div>
					</div>

					{/* Ante Type / Ante */}
					<div className="flex gap-3">
						<div className="flex flex-1 flex-col gap-2">
							<Label htmlFor="anteType">Ante Type</Label>
							<Select
								defaultValue={defaultValues?.anteType ?? "none"}
								name="anteType"
								onValueChange={setAnteType}
							>
								<SelectTrigger className="w-full" id="anteType">
									<SelectValue placeholder="Select ante type" />
								</SelectTrigger>
								<SelectContent>
									{ANTE_TYPES.map((at) => (
										<SelectItem key={at.value} value={at.value}>
											{at.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-1 flex-col gap-2">
							<Label htmlFor="ante">Ante</Label>
							<Input
								defaultValue={defaultValues?.ante}
								disabled={isAnteDisabled}
								id="ante"
								inputMode="numeric"
								min={0}
								name="ante"
								placeholder="0"
								type="number"
							/>
						</div>
					</div>

					{/* Table Size */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="tableSize">Table Size</Label>
						<Select
							defaultValue={defaultValues?.tableSize?.toString()}
							name="tableSize"
						>
							<SelectTrigger className="w-full" id="tableSize">
								<SelectValue placeholder="Select table size" />
							</SelectTrigger>
							<SelectContent>
								{TABLE_SIZES.map((size) => (
									<SelectItem key={size} value={size.toString()}>
										{size}-max
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</>
			) : (
				<>
					{/* Tournament Buy-in / Entry Fee */}
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
							<Label htmlFor="entryFee">Entry Fee</Label>
							<Input
								defaultValue={defaultValues?.entryFee}
								id="entryFee"
								inputMode="numeric"
								min={0}
								name="entryFee"
								placeholder="0"
								type="number"
							/>
						</div>
					</div>

					{/* Placement / Total Entries */}
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="placement">Placement</Label>
							<Input
								defaultValue={defaultValues?.placement}
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
								defaultValue={defaultValues?.totalEntries}
								id="totalEntries"
								inputMode="numeric"
								min={1}
								name="totalEntries"
								placeholder="e.g. 50"
								type="number"
							/>
						</div>
					</div>

					{/* Prize Money */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="prizeMoney">Prize Money</Label>
						<Input
							defaultValue={defaultValues?.prizeMoney}
							id="prizeMoney"
							inputMode="numeric"
							min={0}
							name="prizeMoney"
							placeholder="0"
							type="number"
						/>
					</div>

					{/* Rebuy Count / Rebuy Cost */}
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="rebuyCount">Rebuy Count</Label>
							<Input
								defaultValue={defaultValues?.rebuyCount}
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
								defaultValue={defaultValues?.rebuyCost}
								id="rebuyCost"
								inputMode="numeric"
								min={0}
								name="rebuyCost"
								placeholder="0"
								type="number"
							/>
						</div>
					</div>

					{/* Addon Cost / Bounty Prizes */}
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="addonCost">Addon Cost</Label>
							<Input
								defaultValue={defaultValues?.addonCost}
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
								defaultValue={defaultValues?.bountyPrizes}
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

			{/* Session Tags */}
			<div className="flex flex-col gap-2">
				<Label>Session Tags</Label>
				<TagInput
					availableTags={tags}
					onAdd={(tag) => setSelectedTagIds((prev) => [...prev, tag.id])}
					onCreateTag={onCreateTag}
					onRemove={(tag) =>
						setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id))
					}
					selectedTags={selectedTagIds
						.map((id) => tags?.find((t) => t.id === id))
						.filter((t): t is { id: string; name: string } => t !== undefined)}
				/>
			</div>

			{/* Memo */}
			<div className="flex flex-col gap-2">
				<Label htmlFor="memo">Memo</Label>
				<textarea
					className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					defaultValue={defaultValues?.memo}
					id="memo"
					name="memo"
					placeholder="Notes about this session"
				/>
			</div>

			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
