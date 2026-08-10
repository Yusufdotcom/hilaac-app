/** Same dial pattern as customer cart checkout. */
export function ussdDialString(code: string, amount: number) {
  const trimmed = code.endsWith("#") ? code.slice(0, -1) : code;
  return `${trimmed}${Math.round(amount)}#`;
}
