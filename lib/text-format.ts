/** Capitalises the first non-whitespace character without changing the rest. */
export function capitaliseFirstCharacter(value: string): string {
  return value.replace(/^(\s*)(.)/, (_match, whitespace: string, character: string) =>
    `${whitespace}${character.toUpperCase()}`,
  );
}
