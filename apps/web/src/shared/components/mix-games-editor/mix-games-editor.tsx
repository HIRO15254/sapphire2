import { variantShortLabel } from "@sapphire2/db/constants/game-variants";
import {
	IconArrowDown,
	IconArrowUp,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
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
import { useVariantLabels } from "@/shared/hooks/use-variant-labels";
import type { MixGameGroupRow, MixTemplateKind } from "@/shared/lib/mix-games";
import { useMixGamesEditor } from "./use-mix-games-editor";

const TEMPLATES: Array<{ kind: MixTemplateKind; label: string }> = [
	{ kind: "horse", label: "HORSE" },
	{ kind: "8game", label: "8-Game" },
	{ kind: "10game", label: "10-Game" },
];

const ANTE_TYPES = [
	{ value: "none", label: "No ante" },
	{ value: "bb", label: "BB ante" },
	{ value: "all", label: "All ante" },
] as const;

interface MixGamesEditorProps {
	disabled?: boolean;
	onChange: (rows: MixGameGroupRow[]) => void;
	value: MixGameGroupRow[];
}

interface GroupRowProps {
	disabled: boolean;
	group: MixGameGroupRow;
	index: number;
	isFirst: boolean;
	isLast: boolean;
	onAddVariant: (uid: string, variant: string) => void;
	onMoveDown: (uid: string) => void;
	onMoveUp: (uid: string) => void;
	onRemoveGroup: (uid: string) => void;
	onRemoveVariant: (uid: string, variant: string) => void;
	onUpdateGroup: (
		uid: string,
		patch: Partial<Omit<MixGameGroupRow, "uid">>
	) => void;
	usedVariantList: string[];
}

function GroupRow({
	disabled,
	group,
	index,
	isFirst,
	isLast,
	onAddVariant,
	onMoveDown,
	onMoveUp,
	onRemoveGroup,
	onRemoveVariant,
	onUpdateGroup,
	usedVariantList,
}: GroupRowProps) {
	// Blind slot labels follow the group's first game (groups bundle games
	// sharing one structure, so the first game's family is representative).
	const blindLabels = useVariantLabels(group.variants[0] ?? "nlh");
	const blind3Label = blindLabels.blind3;

	return (
		<div className="flex flex-col gap-2 rounded-md border p-3">
			<div className="flex items-end gap-2">
				<Field
					className="flex flex-1 flex-col gap-1"
					htmlFor={`mix-name-${group.uid}`}
					label="Group name"
				>
					<Input
						disabled={disabled}
						id={`mix-name-${group.uid}`}
						onChange={(e) => onUpdateGroup(group.uid, { name: e.target.value })}
						value={group.name}
					/>
				</Field>
				<Button
					aria-label={`Move group ${index + 1} up`}
					disabled={disabled || isFirst}
					onClick={() => onMoveUp(group.uid)}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<IconArrowUp size={12} />
				</Button>
				<Button
					aria-label={`Move group ${index + 1} down`}
					disabled={disabled || isLast}
					onClick={() => onMoveDown(group.uid)}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<IconArrowDown size={12} />
				</Button>
				<Button
					aria-label={`Remove group ${index + 1}`}
					disabled={disabled}
					onClick={() => onRemoveGroup(group.uid)}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<IconTrash size={12} />
				</Button>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				{group.variants.map((variant) => (
					<Badge key={variant} variant="secondary">
						{variantShortLabel(variant)}
						<button
							aria-label={`Remove ${variantShortLabel(variant)} from group ${index + 1}`}
							className="ml-0.5 inline-flex"
							disabled={disabled}
							onClick={() => onRemoveVariant(group.uid, variant)}
							type="button"
						>
							<IconX size={10} />
						</button>
					</Badge>
				))}
				<div className="w-40">
					<VariantSelect
						disabled={disabled}
						excludeVariants={usedVariantList}
						id={`mix-add-${group.uid}`}
						onChange={(v) => onAddVariant(group.uid, v)}
						value=""
					/>
				</div>
			</div>

			<div
				className={
					blind3Label === null
						? "grid grid-cols-3 gap-2"
						: "grid grid-cols-4 gap-2"
				}
			>
				<Field
					className="flex flex-col gap-1"
					htmlFor={`mix-b1-${group.uid}`}
					label={blindLabels.blind1}
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
					label={blindLabels.blind2}
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
						onChange={(e) => onUpdateGroup(group.uid, { ante: e.target.value })}
						value={group.ante}
					/>
				</Field>
			</div>

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
					<SelectTrigger className="w-full" id={`mix-antetype-${group.uid}`}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{ANTE_TYPES.map((at) => (
							<SelectItem key={at.value} value={at.value}>
								{at.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
		</div>
	);
}

/**
 * Controlled editor for a mix game's named game groups. One row = one group
 * of games sharing a single blind structure (e.g. 8-Game = Limit / Stud /
 * Big Bet). Template buttons prefill common rotations; amounts stay blank
 * for the user to fill.
 */
export function MixGamesEditor({
	disabled = false,
	onChange,
	value,
}: MixGamesEditorProps) {
	const {
		usedVariantList,
		onAddGroup,
		onRemoveGroup,
		onMoveUp,
		onMoveDown,
		onUpdateGroup,
		onAddVariant,
		onRemoveVariant,
		onApplyTemplate,
	} = useMixGamesEditor({ onChange, value });

	return (
		<Field className="rounded-md border p-3" label="Game groups">
			<div className="flex flex-wrap gap-2">
				{TEMPLATES.map((template) => (
					<Button
						disabled={disabled}
						key={template.kind}
						onClick={() => onApplyTemplate(template.kind)}
						size="xs"
						type="button"
						variant="outline"
					>
						{template.label}
					</Button>
				))}
				<Button
					disabled={disabled}
					onClick={onAddGroup}
					size="xs"
					type="button"
					variant="outline"
				>
					<IconPlus size={12} />
					Add group
				</Button>
			</div>
			{value.length > 0 && (
				<div className="flex flex-col gap-2">
					{value.map((group, index) => (
						<GroupRow
							disabled={disabled}
							group={group}
							index={index}
							isFirst={index === 0}
							isLast={index === value.length - 1}
							key={group.uid}
							onAddVariant={onAddVariant}
							onMoveDown={onMoveDown}
							onMoveUp={onMoveUp}
							onRemoveGroup={onRemoveGroup}
							onRemoveVariant={onRemoveVariant}
							onUpdateGroup={onUpdateGroup}
							usedVariantList={usedVariantList}
						/>
					))}
				</div>
			)}
		</Field>
	);
}
