import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
	APP_ITEMS,
	LIBRARY_ITEMS,
	type NavigationItem,
} from "@/shared/components/app-navigation";
import { PageHeader } from "@/shared/components/page-header";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/shared/components/ui/item";

function Group({
	title,
	items,
}: {
	title: string;
	items: readonly NavigationItem[];
}) {
	return (
		<section>
			<h2 className="px-3 pt-3 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-[var(--tracking-caps)]">
				{title}
			</h2>
			<ItemGroup size="xl">
				{items.map((item) => (
					<Item asChild key={item.to}>
						<Link to={item.to}>
							<ItemMedia>
								<item.icon />
							</ItemMedia>
							<ItemContent>
								<ItemTitle>{item.label}</ItemTitle>
							</ItemContent>
							<ItemActions>
								<IconChevronRight aria-hidden />
							</ItemActions>
						</Link>
					</Item>
				))}
			</ItemGroup>
		</section>
	);
}

export function MorePage() {
	return (
		<div className="min-h-full">
			<PageHeader heading="More" />
			<main className="px-3.5">
				<Group items={LIBRARY_ITEMS} title="Library" />
				<Group items={APP_ITEMS} title="App" />
			</main>
		</div>
	);
}
