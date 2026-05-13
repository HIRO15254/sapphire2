import type { ProcedureField } from "@/features/api-tester/procedures";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { useApiTester } from "./use-api-tester";

function FieldRow({
	field,
	value,
	onChange,
}: {
	field: ProcedureField;
	value: string;
	onChange: (next: string) => void;
}) {
	const id = `field-${field.name}`;
	const labelText = (
		<>
			<span className="font-mono text-xs">{field.name}</span>
			<span className="ml-2 text-muted-foreground text-xs">{field.kind}</span>
			{field.required && <span className="ml-1 text-destructive">*</span>}
			{field.nullable && (
				<span className="ml-2 text-muted-foreground text-xs">nullable</span>
			)}
		</>
	);

	if (field.kind === "boolean") {
		const checked = value.trim().toLowerCase() === "true";
		return (
			<div className="flex items-center gap-2">
				<Checkbox
					checked={checked}
					id={id}
					onCheckedChange={(c) => onChange(c ? "true" : "false")}
				/>
				<Label htmlFor={id}>{labelText}</Label>
			</div>
		);
	}

	if (field.kind === "json" || field.kind === "stringArray") {
		return (
			<div className="flex flex-col gap-1">
				<Label htmlFor={id}>{labelText}</Label>
				<Textarea
					className="min-h-24 font-mono text-xs"
					id={id}
					onChange={(e) => onChange(e.target.value)}
					value={value}
				/>
				{field.kind === "stringArray" && (
					<p className="text-muted-foreground text-xs">
						One value per line. Blank lines are ignored.
					</p>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			<Label htmlFor={id}>{labelText}</Label>
			<Input
				id={id}
				inputMode={field.kind === "number" ? "numeric" : "text"}
				onChange={(e) => onChange(e.target.value)}
				value={value}
			/>
		</div>
	);
}

export function ApiTester() {
	const {
		options,
		selectedKey,
		selectedMeta,
		values,
		isPending,
		result,
		resultText,
		previewInput,
		handleSelectChange,
		handleFieldChange,
		handleResetFields,
		handleRun,
		handleClear,
	} = useApiTester();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label htmlFor="procedure">Procedure</Label>
				<Select onValueChange={handleSelectChange} value={selectedKey}>
					<SelectTrigger id="procedure">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{options.map((opt) => (
							<SelectItem key={opt.key} value={opt.key}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{selectedMeta && (
					<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
						<Badge variant="outline">{selectedMeta.kind}</Badge>
						<span className="font-mono">
							{selectedMeta.procedure === ""
								? selectedMeta.router
								: `${selectedMeta.router}.${selectedMeta.procedure}`}
						</span>
					</div>
				)}
			</div>

			{selectedMeta && selectedMeta.fields.length > 0 && (
				<div className="flex flex-col gap-3 rounded-md border p-3">
					<div className="flex items-center justify-between">
						<span className="font-semibold text-sm">Input</span>
						<Button
							onClick={handleResetFields}
							size="xs"
							type="button"
							variant="ghost"
						>
							Reset
						</Button>
					</div>
					{selectedMeta.fields.map((field) => (
						<FieldRow
							field={field}
							key={field.name}
							onChange={(next) => handleFieldChange(field.name, next)}
							value={values[field.name] ?? ""}
						/>
					))}
				</div>
			)}

			{selectedMeta && selectedMeta.fields.length === 0 && (
				<p className="text-muted-foreground text-sm">No input required.</p>
			)}

			<div className="flex flex-col gap-2">
				<Label htmlFor="preview">Built input (preview)</Label>
				<Textarea
					className="min-h-20 font-mono text-xs"
					id="preview"
					readOnly
					value={previewInput}
				/>
			</div>

			<div className="flex items-center gap-2">
				<Button disabled={isPending} onClick={handleRun} type="button">
					{isPending ? "Running…" : "Run"}
				</Button>
				<Button
					disabled={isPending || result.status === "idle"}
					onClick={handleClear}
					type="button"
					variant="outline"
				>
					Clear
				</Button>
				{result.status !== "idle" && result.durationMs !== undefined && (
					<span className="text-muted-foreground text-xs">
						{result.durationMs}ms
					</span>
				)}
				{result.status === "success" && (
					<Badge className="bg-green-600 text-white">success</Badge>
				)}
				{result.status === "error" && (
					<Badge variant="destructive">error</Badge>
				)}
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="result">Result</Label>
				<Textarea
					className="min-h-64 font-mono text-xs"
					id="result"
					readOnly
					value={resultText}
				/>
			</div>
		</div>
	);
}
