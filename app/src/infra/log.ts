// Centralized typed logger. Each level maps to its matching console method so levels stay distinct
// in logcat/Metro, and there is one place to later silence or redirect them. Context values are
// restricted to primitives — never log player identity, raw frames, or any other sensitive data
// (privacy guardrails, ADR-0007/0008).
type Context = Readonly<Record<string, string | number | boolean>>;

function format(message: string, context?: Context): string {
  return context === undefined ? message : `${message} ${JSON.stringify(context)}`;
}

export const log = {
  info(message: string, context?: Context): void {
    console.info(`[snarl] ${format(message, context)}`);
  },
  warn(message: string, context?: Context): void {
    console.warn(`[snarl:warn] ${format(message, context)}`);
  },
  error(message: string, context?: Context): void {
    console.error(`[snarl:error] ${format(message, context)}`);
  },
};
