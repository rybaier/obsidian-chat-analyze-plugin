const TEMPLATE_PATTERN = /\{\{(\w+)\}\}/g;

export function renderTemplate(
	template: string,
	variables: Record<string, string>
): string {
	return template.replace(TEMPLATE_PATTERN, (match, varName: string) => {
		if (varName in variables) {
			return variables[varName];
		}
		return match;
	});
}
