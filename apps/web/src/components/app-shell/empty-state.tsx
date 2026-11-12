import type { Icon } from "@tabler/icons-react";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
} from "@/components/ui/empty/empty";

/** An icon and one line, for a section with nothing to show or one that failed to load. */
export function EmptyState({
	description,
	icon: IconComponent,
}: {
	description: string;
	icon: Icon;
}) {
	return (
		<Empty className="py-8">
			<EmptyHeader>
				<EmptyMedia>
					<IconComponent aria-hidden />
				</EmptyMedia>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
