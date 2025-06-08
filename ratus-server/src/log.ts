/**
 * Logs a message with a timestamp and type. Errors are sent to stderr.
 * @param type - Log type (e.g., $E for error)
 * @param msg - Message to log
 */
export function log(type: string, msg: unknown): void {
  const timestamp = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
    .format(new Date())
    .replace(",", "-")
    .replace(/\//g, ".")
    .replace(/ /g, "");
  const final = `${timestamp}\t${type}\t"${String(msg)}"`;
  if (type === "$E") {
    console.error(final);
  } else {
    console.log(final);
  }
}
