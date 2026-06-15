export interface LegendItem {
	color: string;
	dashed: boolean;
	value: string;
}

export function CustomLegend({ items }: { items: LegendItem[] }) {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[11px]">
			{items.map((item) => (
				<div className="flex items-center gap-1.5" key={item.value}>
					<svg
						aria-hidden="true"
						className="shrink-0"
						height={6}
						viewBox="0 0 14 6"
						width={14}
					>
						<line
							stroke={item.color}
							strokeDasharray={item.dashed ? "3 2" : undefined}
							strokeWidth={2}
							x1={0}
							x2={14}
							y1={3}
							y2={3}
						/>
					</svg>
					<span className="text-foreground">{item.value}</span>
				</div>
			))}
		</div>
	);
}
