import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
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

export function ApiTester() {
	const {
		options,
		selectedKey,
		selectedMeta,
		input,
		inputHint,
		isPending,
		result,
		resultText,
		handleSelectChange,
		handleInputChange,
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

			<div className="flex flex-col gap-2">
				<Label htmlFor="input">Input (JSON)</Label>
				<Textarea
					className="min-h-32 font-mono text-xs"
					id="input"
					onChange={(e) => handleInputChange(e.target.value)}
					value={input}
				/>
				{inputHint && (
					<p className="text-muted-foreground text-xs">
						Hint: <span className="font-mono">{inputHint}</span>
					</p>
				)}
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
