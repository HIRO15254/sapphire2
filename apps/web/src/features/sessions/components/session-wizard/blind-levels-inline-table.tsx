import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { SessionBlindLevelInput } from "@/features/sessions/utils/session-form-helpers";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";

interface BlindLevelsInlineTableProps {
	onChange: (next: SessionBlindLevelInput[]) => void;
	value: SessionBlindLevelInput[];
}

function emptyLevel(): SessionBlindLevelInput {
	return {
		isBreak: false,
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
		minutes: null,
	};
}

function parseIntOrNull(value: string): number | null {
	if (value === "") {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function strOrEmpty(value: number | null): string {
	return value === null ? "" : String(value);
}

export function BlindLevelsInlineTable({
	value,
	onChange,
}: BlindLevelsInlineTableProps) {
	const updateAt = (index: number, patch: Partial<SessionBlindLevelInput>) => {
		onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
	};
	const removeAt = (index: number) => {
		onChange(value.filter((_, i) => i !== index));
	};
	const addLevel = () => {
		onChange([...value, emptyLevel()]);
	};
	const addBreak = () => {
		onChange([...value, { ...emptyLevel(), isBreak: true }]);
	};

	return (
		<Field
			className="rounded-md border p-3"
			description="Define how blinds progress during the tournament."
			label="Blind Levels"
		>
			<div className="flex items-center gap-2">
				<Button onClick={addLevel} size="xs" type="button" variant="outline">
					<IconPlus size={12} />
					Level
				</Button>
				<Button onClick={addBreak} size="xs" type="button" variant="outline">
					<IconPlus size={12} />
					Break
				</Button>
			</div>
			{value.length > 0 && (
				<Table className="text-xs">
					<TableHeader>
						<TableRow>
							<TableHead className="h-auto w-8 pb-1 text-center">#</TableHead>
							<TableHead className="h-auto pb-1 text-center">SB</TableHead>
							<TableHead className="h-auto pb-1 text-center">BB</TableHead>
							<TableHead className="h-auto pb-1 text-center">Ante</TableHead>
							<TableHead className="h-auto pb-1 text-center">Min</TableHead>
							<TableHead className="h-auto w-12 pb-1 text-center">
								Break
							</TableHead>
							<TableHead className="h-auto w-8 pb-1" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{value.map((row, idx) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: blind levels carry no stable id; their position IS their identity.
							<TableRow key={`level-${idx}`}>
								<TableCell className="text-center text-muted-foreground">
									{idx + 1}
								</TableCell>
								<TableCell>
									<Input
										className="h-7 text-center"
										disabled={row.isBreak}
										inputMode="numeric"
										onChange={(e) =>
											updateAt(idx, { blind1: parseIntOrNull(e.target.value) })
										}
										value={strOrEmpty(row.blind1)}
									/>
								</TableCell>
								<TableCell>
									<Input
										className="h-7 text-center"
										disabled={row.isBreak}
										inputMode="numeric"
										onChange={(e) =>
											updateAt(idx, { blind2: parseIntOrNull(e.target.value) })
										}
										value={strOrEmpty(row.blind2)}
									/>
								</TableCell>
								<TableCell>
									<Input
										className="h-7 text-center"
										disabled={row.isBreak}
										inputMode="numeric"
										onChange={(e) =>
											updateAt(idx, { ante: parseIntOrNull(e.target.value) })
										}
										value={strOrEmpty(row.ante)}
									/>
								</TableCell>
								<TableCell>
									<Input
										className="h-7 text-center"
										inputMode="numeric"
										onChange={(e) =>
											updateAt(idx, { minutes: parseIntOrNull(e.target.value) })
										}
										value={strOrEmpty(row.minutes)}
									/>
								</TableCell>
								<TableCell className="text-center">
									<Checkbox
										checked={row.isBreak}
										onCheckedChange={(checked) =>
											updateAt(idx, { isBreak: checked === true })
										}
									/>
								</TableCell>
								<TableCell className="text-center">
									<Button
										aria-label={`Remove level ${idx + 1}`}
										onClick={() => removeAt(idx)}
										size="icon-xs"
										type="button"
										variant="ghost"
									>
										<IconTrash size={12} />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</Field>
	);
}
