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
			<PageHeader
				actions={
					<div className="hidden items-center gap-2 md:flex">
						<Button asChild variant="outline">
							<Link to={pastTo}>
								<IconPlus aria-hidden />
								Add past session
							</Link>
						</Button>
						<Button asChild>
							<Link to={liveTo}>
								<IconPlayerPlay aria-hidden />
								Start live session
							</Link>
						</Button>
					</div>
				}
				heading="Home"
				meta={<span className="md:hidden">{todayLabel}</span>}
			/>
			<main className="flex flex-1 flex-col gap-4 px-3.5 pt-3 pb-4 md:p-0">
				<div className="flex items-center gap-2 md:hidden">
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
