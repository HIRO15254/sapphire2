import { Field } from "@/shared/components/ui/field";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";
import { CRYST_FIELD } from "../../cryst-controls";
import { SegmentedControl } from "../../segmented-control";
import { ANTE_TYPE_OPTIONS, type AnteType } from "./session-sheet-view";
import type { MixStakeSlot } from "./use-session-sheet";

const NUMBER_CLASS = `${CRYST_FIELD} mt-1.5 box-border h-[var(--m-control)] w-full px-2.5 font-mono`;

interface MixStakeCell {
	error: string | undefined;
	value: string;
}

interface MixStakesFieldsProps {
	ante: MixStakeCell;
	anteType: AnteType;
	blinds: (MixStakeCell & { label: string; slot: MixStakeSlot })[];
	codes: string;
	name: string;
	onAnteTypeChange: (anteType: AnteType) => void;
	onChange: (slot: MixStakeSlot, value: string) => void;
	uid: string;
}

export function MixStakesFields({
	ante,
	anteType,
	blinds,
	codes,
	name,
	onAnteTypeChange,
	onChange,
	uid,
}: MixStakesFieldsProps) {
	const idOf = (part: string) => `cryst-mix-${uid}-${part}`;

	return (
		<fieldset
			aria-labelledby={idOf("name")}
			className="col-span-6 grid min-w-0 grid-cols-6 items-end gap-x-2 gap-y-3 rounded-lg border border-border p-2.5"
		>
			<div className="col-span-6 flex min-w-0 items-baseline gap-2">
				<span
					className="min-w-0 truncate font-semibold text-[length:var(--text-sm)]"
					id={idOf("name")}
				>
					{name}
				</span>
				<span className="min-w-0 truncate font-mono text-[length:var(--text-xs)] text-muted-foreground">
					{codes}
				</span>
			</div>
			{blinds.map((cell) => (
				<Field
					className="col-span-2 min-w-0 gap-0"
					error={cell.error}
					htmlFor={idOf(cell.slot)}
					key={cell.slot}
					label={cell.label}
				>
					<input
						{...NO_INPUT_SUGGESTIONS}
						className={NUMBER_CLASS}
						id={idOf(cell.slot)}
						inputMode="numeric"
						onChange={(e) => onChange(cell.slot, e.target.value)}
						type="text"
						value={cell.value}
					/>
				</Field>
			))}
			<div className="col-span-4 min-w-0">
				<span
					className="mb-1.5 block font-medium text-[length:var(--text-sm)] text-foreground"
					id={idOf("ante-type")}
				>
					Ante type
				</span>
				<SegmentedControl
					aria-labelledby={idOf("ante-type")}
					onChange={onAnteTypeChange}
					options={ANTE_TYPE_OPTIONS}
					value={anteType}
				/>
			</div>
			<Field
				className="col-span-2 min-w-0 gap-0"
				error={ante.error}
				htmlFor={idOf("ante")}
				label="Ante"
			>
				<input
					{...NO_INPUT_SUGGESTIONS}
					className={NUMBER_CLASS}
					disabled={anteType === "none"}
					id={idOf("ante")}
					inputMode="numeric"
					onChange={(e) => onChange("ante", e.target.value)}
					type="text"
					value={ante.value}
				/>
			</Field>
		</fieldset>
	);
}
