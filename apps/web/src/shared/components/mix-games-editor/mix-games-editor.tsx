import { IconX } from "@tabler/icons-react";
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
import type {
	MixGameGroupRow,
	MixTemplateKind,
	ResolveGroup,
} from "@/shared/lib/mix-games";
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
	/** variant label → owning group; from useGameGroups at the mount site. */
	resolveGroup: ResolveGroup;
	/** builtinKey → the user's variant label (null when deleted). */
	resolveVariantLabel: (builtinKey: string) => string | null;
	/** Hide the per-group ante-type select (tournament level groups). */
	showAnteType?: boolean;
	value: MixGameGroupRow[];
}

interface BucketRowProps {
	disabled: boolean;
	group: MixGameGroupRow;
	onRemoveVariant: (variant: string) => void;
	onUpdateGroup: (
		uid: string,
		patch: Partial<Omit<MixGameGroupRow, "uid" | "groupId">>
	) => void;
	showAnteType: boolean;
}

// One derived bucket = the games of one master group sharing a structure.
// Membership is not editable here (it follows the master mapping); only the
// per-mix name, the amounts, and which games participate are.
function BucketRow({
	disabled,
	group,
	onRemoveVariant,
	onUpdateGroup,
	showAnteType,
}: BucketRowProps) {
	const blind3Label = group.blind3Label;
	const amountCols = blind3Label === null ? "grid-cols-3" : "grid-cols-4";

	return (
		<div className="flex flex-col gap-2 rounded-md border p-3">
			<div className="flex items-center justify-between gap-2">
				<span className="t-meta text-muted-foreground">{group.groupLabel}</span>
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
			<div className="flex flex-wrap items-center gap-1.5">
				{group.variants.map((variant) => (
					<Badge key={variant} variant="secondary">
						{variant}
						<button
							aria-label={`Remove ${variant}`}
							className="ml-1 inline-flex"
							disabled={disabled}
							onClick={() => onRemoveVariant(variant)}
							type="button"
						>
							<IconX size={12} />
						</button>
					</Badge>
				))}
			</div>
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
						onChange={(e) => onUpdateGroup(group.uid, { ante: e.target.value })}
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
			)}
		</div>
	);
}

export function MixGamesEditor({
	disabled = false,
	onChange,
	resolveGroup,
	resolveVariantLabel,
	showAnteType = true,
	value,
}: MixGamesEditorProps) {
	const {
		usedVariantList,
		onAddVariant,
		onRemoveVariant,
		onUpdateGroup,
		onApplyTemplate,
	} = useMixGamesEditor({ onChange, resolveGroup, resolveVariantLabel, value });

	return (
		<Field className="rounded-md border p-3" label="Games">
			<div className="flex flex-wrap items-center gap-2">
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
			</div>
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
					value=""
				/>
			</Field>
			{value.length > 0 && (
				<div className="flex flex-col gap-2">
					{value.map((group) => (
						<BucketRow
							disabled={disabled}
							group={group}
							key={group.uid}
							onRemoveVariant={onRemoveVariant}
							onUpdateGroup={onUpdateGroup}
							showAnteType={showAnteType}
						/>
					))}
				</div>
			)}
		</Field>
	);
}
