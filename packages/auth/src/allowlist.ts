export function parseAllowedEmails(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter((email) => email.length > 0);
}

export function isEmailAllowed(
	email: string,
	allowedEmails: readonly string[]
): boolean {
	return allowedEmails.includes(email.trim().toLowerCase());
}
