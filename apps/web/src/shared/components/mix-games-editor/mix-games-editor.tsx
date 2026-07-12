import { IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { Badge } from "@/shared/components/ui/badge";
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
import { VariantSelect } from "@/shared/components/variant-select";
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
	/**
	 * Allow editing which games are played inline (add/remove games and
	 * whole groups). Tournament level editors own their per-level
	 * composition, so they opt in; master-backed forms leave this off and
	 * only edit amounts.
	 */
	structureEditable?: boolean;
	value: MixGameGroupRow[];
}

interface BucketRowProps {
	disabled: boolean;
	group: MixGameGroupRow;
	onRemoveGroup: (uid: string) => void;
	onRemoveVariant: (variant: string) => void;
	onUpdateGroup: (
		uid: string,
		patch: Partial<Omit<MixGameGroupRow, "uid" | "groupId">>
	) => void;
	showAnteType: boolean;
	structureEditable: boolean;
}

// One derived bucket = the games of one master group sharing a structure.
// Membership follows the master mapping; inline edits cover the per-mix
// name and the amounts, plus (only when structureEditable) which games
// participate. The header band mirrors the Games page's group cards so
// "a group and its games" reads the same in both places.
function BucketRow({
	disabled,
	group,
	onRemoveGroup,
	onRemoveVariant,
	onUpdateGroup,
	showAnteType,
	structureEditable,
}: BucketRowProps) {
	const blind3Label = group.blind3Label;
	// 2-up on phones (4 columns leave ~65px per cell inside the nested card),
	// full row from sm up.
	const amountCols =
		blind3Label === null
			? "grid-cols-2 sm:grid-cols-3"
			: "grid-cols-2 sm:grid-cols-4";

	return (
		<div className="rounded-md border">
			<div className="flex items-center justify-between gap-2 rounded-t-md bg-muted/50 px-3 py-1.5">
				<span className="truncate font-medium text-sm">{group.groupLabel}</span>
				{structureEditable && (
					<Button
						aria-label={`Remove ${group.groupLabel} games`}
						className="shrink-0 text-destructive"
						disabled={disabled}
						onClick={() => onRemoveGroup(group.uid)}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<IconTrash size={14} />
					</Button>
				)}
			</div>
			<div className="flex flex-col gap-2 border-t p-3">
				<div className="flex flex-wrap items-center gap-1.5">
					{group.variants.map((variant) =>
						structureEditable ? (
							<Badge className="gap-1 pr-1" key={variant} variant="secondary">
								{variant}
								<Button
									aria-label={`Remove ${variant}`}
									className="size-4 text-muted-foreground hover:text-foreground"
									disabled={disabled}
									onClick={() => onRemoveVariant(variant)}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<IconX size={10} />
								</Button>
							</Badge>
						) : (
							<Badge key={variant} variant="secondary">
								{variant}
							</Badge>
						)
					)}
				</div>
				<Field
					className="flex flex-col gap-1"
					htmlFor={`mix-name-${group.uid}`}
					label="Display name"
				>
					<Input
						disabled={disabled}
						id={`mix-name-${group.uid}`}
						onChange={(e) => onUpdateGroup(group.uid, { name: e.target.value })}
						value={group.name}
					/>
				</Field>
				<div className={`grid gap-2 ${amountCols}`}>
					<Field
						className="flex flex-col gap-1"
						htmlFor={`mix-b1-${group.uid}`}
						label={group.blind1Label}
					>
						<Input
							disabled={disabled}
							id={`mix-b1-${group.uid}`}
							inputMode="numeric"
							onChange={(e) =>
								onUpdateGroup(group.uid, { blind1: e.target.value })
							}
							value={group.blind1}
						/>
					</Field>
					<Field
						className="flex flex-col gap-1"
						htmlFor={`mix-b2-${group.uid}`}
						label={group.blind2Label}
					>
						<Input
							disabled={disabled}
							id={`mix-b2-${group.uid}`}
							inputMode="numeric"
							onChange={(e) =>
								onUpdateGroup(group.uid, { blind2: e.target.value })
							}
							value={group.blind2}
						/>
					</Field>
					{blind3Label !== null && (
						<Field
							className="flex flex-col gap-1"
							htmlFor={`mix-b3-${group.uid}`}
							label={blind3Label}
						>
							<Input
								disabled={disabled}
								id={`mix-b3-${group.uid}`}
								inputMode="numeric"
								onChange={(e) =>
									onUpdateGroup(group.uid, { blind3: e.target.value })
								}
								value={group.blind3}
							/>
						</Field>
					)}
					<Field
						className="flex flex-col gap-1"
						htmlFor={`mix-ante-${group.uid}`}
						label="Ante"
					>
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
				{showAnteType && (
					<Field
						className="flex flex-col gap-1"
						htmlFor={`mix-antetype-${group.uid}`}
						label="Ante type"
					>
						<Select
							disabled={disabled}
							onValueChange={(v) =>
								onUpdateGroup(group.uid, {
									anteType: v as MixGameGroupRow["anteType"],
								})
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
				)}
			</div>
		</div>
	);
}

export function MixGamesEditor({
	disabled = false,
	onChange,
	onEditMix,
	resolveGroup,
	showAnteType = true,
	structureEditable = false,
	value,
}: MixGamesEditorProps) {
	const {
		usedVariantList,
		onAddVariant,
		onRemoveGroup,
		onRemoveVariant,
		onUpdateGroup,
	} = useMixGamesEditor({ onChange, resolveGroup, value });

	return (
		<Field className="rounded-md border p-3" label="Games">
			{structureEditable ? (
				<Field
					className="flex flex-col gap-1"
					htmlFor="mix-add-game"
					label="Add game"
				>
					<VariantSelect
						disabled={disabled}
						excludeVariants={usedVariantList}
						id="mix-add-game"
						includeMix={false}
						onChange={onAddVariant}
						placeholder="Select a game"
						value=""
					/>
				</Field>
			) : (
				onEditMix && (
					<Button
						className="self-end"
						disabled={disabled}
						onClick={onEditMix}
						size="sm"
						type="button"
						variant="outline"
					>
						<IconPencil size={16} />
						Edit mix
					</Button>
				)
			)}
			{value.length === 0 ? (
				<p className="py-2 text-center text-muted-foreground text-sm">
					{structureEditable ? "No games added yet." : "No games in this mix."}
				</p>
			) : (
				<div className="flex flex-col gap-2">
					{value.map((group) => (
						<BucketRow
							disabled={disabled}
							group={group}
							key={group.uid}
							onRemoveGroup={onRemoveGroup}
							onRemoveVariant={onRemoveVariant}
							onUpdateGroup={onUpdateGroup}
							showAnteType={showAnteType}
							structureEditable={structureEditable}
						/>
					))}
				</div>
			)}
		</Field>
	);
}
