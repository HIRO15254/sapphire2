import { IconCards, IconPlayerPlay, IconPlus } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/shared/components/ui/empty";
import { IconButton } from "@/shared/components/ui/icon-button";

import { useHomePage } from "./use-home-page";

const liveTo: string = "/live/new";
const pastTo: string = "/sessions/new";

export function HomePage() {
	const { todayLabel } = useHomePage();
	return (
		<div className="flex min-h-full flex-col">
			<PageHeader heading="Home" meta={todayLabel} />
			<main className="flex flex-1 flex-col gap-4 px-3.5 pt-3 pb-4">
				<div className="flex items-center gap-2">
					<Button asChild className="flex-1" size="xl">
						<Link to={liveTo}>
							<IconPlayerPlay aria-hidden />
							Start live session
						</Link>
					</Button>
					<IconButton
						asChild
						label="Add past session"
						size="xl"
						variant="outline"
					>
						<Link to={pastTo}>
							<IconPlus aria-hidden />
						</Link>
					</IconButton>
				</div>
				<Empty className="flex-1">
					<EmptyHeader>
						<EmptyMedia>
							<IconCards aria-hidden />
						</EmptyMedia>
						<EmptyTitle>No sessions yet</EmptyTitle>
						<EmptyDescription>
							Start a live session at the table, or add one you already played.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</main>
		</div>
	);
}
