import { useTheme } from "next-themes";

export function useToaster() {
	const { theme = "system" } = useTheme();
	return { theme };
}
