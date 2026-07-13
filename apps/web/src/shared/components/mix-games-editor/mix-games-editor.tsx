import { IconPencil } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { ANTE_TYPE_OPTIONS } from "@/shared/lib/ante-types";
import type { MixGameGroupRow, ResolveGroup } from "@/shared/lib/mix-games";
import { useMixGamesEditor } from "./use-mix-games-editor";

interface MixGamesEditorProps {
	disabled?: boolean;
	onChange: (rows: MixGameGroupRow[]) => void;
	/**
	 * Renders an "Edit mix" affordance opening the mix-master sheet. Only
	 * meaningful while the composition is read-only (the default): the
	 * composition follows the mix master, so changing it means editing the
	 * master itself.
	 */
	onEditMix?: () => void;
	/** variant label → owning group; from useGameGroups at the mount site. */
	resolveGroup: ResolveGroup;
	/** Hide the per-group ante-type select (tournament level groups). */
	showAnteType?: boolean;
	value: MixGameGroupRow[];
}

interface GroupFieldsProps {
	disabled: boolean;
	group: MixGameGroupRow;
	onUpdateAnteType: (
		uid: string,
		anteType: MixGameGroupRow["anteType"]
	) => void;
	onUpdateGroup: (
		uid: string,
		patch: Partial<Omit<MixGameGroupRow, "uid" | "groupId">>
	) => void;
	showAnteType: boolean;
}

// One compact tier per group: a heading line (per-mix display name + its
// games) over the same flat blind/ante fields a non-mix variant renders —
// no card chrome, mirroring the plain blind-input section of the form.
function CompactGroupFields({
	disabled,
	group,
	onUpdateAnteType,
	onUpdateGroup,
	showAnteType,
}: GroupFieldsProps) {
	const blind3Label = group.blind3Label;

	const blindInput = (slot: "blind1" | "blind2" | "blind3", label: string) => (
		<Field htmlFor={`mix-${slot}-${group.uid}`} label={label}>
			<Input
				disabled={disabled}
				id={`mix-${slot}-${group.uid}`}
				inputMode="numeric"
				onChange={(e) => onUpdateGroup(group.uid, { [slot]: e.target.value })}
				value={group[slot]}
			/>
		</Field>
	);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
				{/* Display fallback only — a null name stays null in state so it
				    is never persisted as a frozen label (c18). */}
				<span className="font-medium text-sm">
					{group.name ?? group.groupLabel}
				</span>
				<span className="text-muted-foreground text-xs">
					{group.variants.join(" · ")}
				</span>
			</div>
			{showAnteType ? (
				<>
					<div
						className={
							blind3Label === null
								? "grid grid-cols-2 gap-3"
								: "grid grid-cols-3 gap-3"
						}
					>
						{blindInput("blind1", group.blind1Label)}
						{blindInput("blind2", group.blind2Label)}
						{blind3Label !== null && blindInput("blind3", blind3Label)}
					</div>
					<div className="flex gap-3">
						<Field
							className="flex-1"
							htmlFor={`mix-antetype-${group.uid}`}
							label="Ante type"
						>
							<Select
								disabled={disabled}
								onValueChange={(v) =>
									onUpdateAnteType(group.uid, v as MixGameGroupRow["anteType"])
								}
								value={group.anteType}
							>
								<SelectTrigger
									className="w-full"
									id={`mix-antetype-${group.uid}`}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ANTE_TYPE_OPTIONS.map((at) => (
										<SelectItem key={at.value} value={at.value}>
											{at.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field
							className="flex-1"
							htmlFor={`mix-ante-${group.uid}`}
							label="Ante"
						>
							<Input
								disabled={disabled || group.anteType === "none"}
								id={`mix-ante-${group.uid}`}
								inputMode="numeric"
								onChange={(e) =>
									onUpdateGroup(group.uid, { ante: e.target.value })
								}
								value={group.ante}
							/>
						</Field>
					</div>
				</>
			) : (
				<div
					className={
						blind3Label === null
							? "grid grid-cols-3 gap-3"
							: "grid grid-cols-2 gap-3 sm:grid-cols-4"
					}
				>
					{blindInput("blind1", group.blind1Label)}
					{blindInput("blind2", group.blind2Label)}
					{blind3Label !== null && blindInput("blind3", blind3Label)}
					<Field htmlFor={`mix-ante-${group.uid}`} label="Ante">
						<Input
							disabled={disabled}
							id={`mix-ante-${group.uid}`}
							inputMode="numeric"
							onChange={(e) =>
								onUpdateGroup(group.uid, { ante: e.target.value })
							}
							value={group.ante}
						/>
					</Field>
				</div>
			)}
		</div>
	);
}

export function MixGamesEditor({
	disabled = false,
	onChange,
	onEditMix,
	resolveGroup,
	showAnteType = true,
	value,
}: MixGamesEditorProps) {
	const { onUpdateAnteType, onUpdateGroup } = useMixGamesEditor({
		onChange,
		resolveGroup,
		value,
	});

	// Compact tiers, no card chrome: one heading + flat blind fields per
	// group, exactly like the non-mix blind section but repeated. The
	// composition itself is read-only — it follows the mix master (or the
	// level's assigned variant), never inline edits.
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-2">
				<span className="font-medium text-sm">Games</span>
				{onEditMix && (
					<Button
						disabled={disabled}
						onClick={onEditMix}
						size="xs"
						type="button"
						variant="ghost"
					>
						<IconPencil size={14} />
						Edit mix
					</Button>
				)}
			</div>
			{value.length === 0 ? (
				<p className="py-2 text-center text-muted-foreground text-sm">
					No games in this mix.
				</p>
			) : (
				value.map((group) => (
					<CompactGroupFields
						disabled={disabled}
						group={group}
						key={group.uid}
						onUpdateAnteType={onUpdateAnteType}
						onUpdateGroup={onUpdateGroup}
						showAnteType={showAnteType}
					/>
				))
			)}
		</div>
	);
}
