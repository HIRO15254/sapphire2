import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
	APP_ITEMS,
	LIBRARY_ITEMS,
	type NavigationItem,
} from "@/shared/components/app-navigation";
import { PageHeader } from "@/shared/components/page-header";

function Group({
	title,
	items,
}: {
	title: string;
	items: readonly NavigationItem[];
}) {
	return (
		<section>
			<h2 className="px-2 pt-3 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-[var(--tracking-caps)]">
				{title}
			</h2>
			<ul>
				{items.map((item) => (
					<li key={item.to}>
						<Link
							className="flex h-[var(--m-list-row)] items-center gap-2 rounded-md px-2 text-sm hover:bg-[var(--state-hover)]"
							to={item.to}
						>
							<item.icon size={18} />
							<span className="flex-1">{item.label}</span>
							<IconChevronRight className="text-muted-foreground" size={18} />
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}

export function MorePage() {
	return (
		<div className="min-h-full">
			<PageHeader heading="More" />
			<main className="px-3.5 md:px-6">
				<Group items={LIBRARY_ITEMS} title="Library" />
				<Group items={APP_ITEMS} title="App" />
			</main>
		</div>
	);
}
