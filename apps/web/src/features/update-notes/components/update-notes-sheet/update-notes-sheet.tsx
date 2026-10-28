import { IconChevronDown, IconChevronUp, IconNews } from "@tabler/icons-react";
import { Fragment } from "react";
import { Badge } from "@/shared/components/ui/badge";
import {
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerDescription,
	DrawerGrab,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/shared/components/ui/empty";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemTitle,
} from "@/shared/components/ui/item";
import { useUpdateNotesReleases } from "./use-update-notes-releases";

export function UpdateNotesSheet() {
	const { isOpen, onOpenChange, onToggleRelease, releases } =
		useUpdateNotesReleases();

	return (
		<Drawer onOpenChange={onOpenChange} open={isOpen}>
			<DrawerContent>
				<DrawerGrab />
				<DrawerHeader>
					<DrawerTitle>Update notes</DrawerTitle>
					<DrawerDescription className="sr-only">
						Release notes for recent updates.
					</DrawerDescription>
				</DrawerHeader>
				<DrawerBody>
					{releases.length === 0 ? (
						<Empty className="gap-2.5 px-4 py-6">
							<EmptyHeader>
								<EmptyMedia>
									<IconNews aria-hidden />
								</EmptyMedia>
								<EmptyTitle>No update notes yet</EmptyTitle>
								<EmptyDescription>
									Notes for each release appear here.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<ItemGroup aria-label="Releases" size="xl" variant="inset">
							{releases.map((release) => {
								const panelId = `release-${release.version}`;
								return (
									<Fragment key={release.version}>
										<Item asChild>
											<button
												aria-controls={panelId}
												aria-expanded={release.isExpanded}
												onClick={() => onToggleRelease(release.version)}
												type="button"
											>
												<ItemContent>
													<ItemTitle className="flex items-center gap-2">
														<span className="font-mono font-semibold">
															{release.version}
														</span>
														{release.isNew ? <Badge>New</Badge> : null}
													</ItemTitle>
												</ItemContent>
												<ItemActions className="gap-2">
													<span>{release.releasedOn}</span>
													{release.isExpanded ? (
														<IconChevronUp aria-hidden />
													) : (
														<IconChevronDown aria-hidden />
													)}
												</ItemActions>
											</button>
										</Item>
										{release.isExpanded ? (
											<div
												className="px-3.5 pt-0.5 pb-3.5 text-[length:var(--m-text-secondary)]"
												id={panelId}
											>
												<p className="m-0 font-medium">{release.title}</p>
												{release.changes.map((group) => (
													<Fragment key={group.section || "general"}>
														{group.section ? (
															<p className="mt-2.5 mb-1 font-semibold text-[length:var(--m-text-footnote)] text-muted-foreground uppercase tracking-[var(--tracking-caps)]">
																{group.section}
															</p>
														) : null}
														<ul className="m-0 flex list-disc flex-col gap-1 pl-[18px] leading-normal">
															{group.items.map((item) => (
																<li key={item}>{item}</li>
															))}
														</ul>
													</Fragment>
												))}
											</div>
										) : null}
									</Fragment>
								);
							})}
						</ItemGroup>
					)}
				</DrawerBody>
			</DrawerContent>
		</Drawer>
	);
}
