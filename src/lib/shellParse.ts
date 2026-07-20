export function parseCommandLine(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && inQuote !== "'") {
      escaped = true;
      continue;
    }
    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      inQuote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function serializeCommandLine(command: string, args: string[]): string {
  return [command, ...args].map(quoteIfNeeded).join(" ");
}

function quoteIfNeeded(token: string): string {
  if (token === "") return "''";
  if (!/[\s'"\\$]/.test(token)) return token;
  if (!token.includes("'")) return `'${token}'`;
  return `"${token.replace(/(["\\$])/g, "\\$1")}"`;
}
