/**
 * Adjusts the given date to a specific time (hour, minute, second, and millisecond).
 * @param date - The date to be adjusted
 * @param hour - The hour to set
 * @param minute - The minute to set
 * @param second - The second to set
 * @param ms - The millisecond to set
 * @returns The adjusted date
 */
const adjustDateTime = (date: Date, hour: number, minute: number, second: number, ms: number) => {
  const adjustedDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, second, ms)
  );
  return adjustedDate;
};

export default adjustDateTime;
