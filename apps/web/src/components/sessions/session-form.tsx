import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { CashGameFields } from "./cash-game-fields";
import { TournamentFields } from "./tournament-fields";

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

function parseCashGameFields(
	formData: FormData
): Omit<
	CashGameFormValues,
	"endTime" | "memo" | "sessionDate" | "startTime" | "tagIds"
> {
	const anteType = (formData.get("anteType") as string) || "none";
	return {
		type: "cash_game",
		buyIn: Number(formData.get("buyIn")),
		cashOut: Number(formData.get("cashOut")),
		variant: (formData.get("variant") as string) || "nlh",
		blind1: parseOptionalInt(formData.get("blind1") as string),
		blind2: parseOptionalInt(formData.get("blind2") as string),
		blind3: parseOptionalInt(formData.get("blind3") as string),
		ante:
			anteType === "none"
				? undefined
				: parseOptionalInt(formData.get("ante") as string),
		anteType: anteType || undefined,
		tableSize: parseOptionalInt(formData.get("tableSize") as string),
	};
}

function parseTournamentFields(
	formData: FormData
): Omit<
	TournamentFormValues,
	"endTime" | "memo" | "sessionDate" | "startTime" | "tagIds"
> {
	return {
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
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
		defaultValues?.tagIds ?? []
	);

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
			onSubmit({ ...common, ...parseCashGameFields(formData) });
		} else {
			onSubmit({ ...common, ...parseTournamentFields(formData) });
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

			{/* Type-specific fields */}
			{isCashGame ? (
				<CashGameFields defaultValues={defaultValues} />
			) : (
				<TournamentFields defaultValues={defaultValues} />
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
