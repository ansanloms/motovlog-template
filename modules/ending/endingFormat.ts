/** 走行日の範囲。単日は from と to を同じ日にする。 */
export type DateRange = {
  from: Temporal.ZonedDateTime;
  to: Temporal.ZonedDateTime;
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * ED の DATE 欄の書式 (ADR-0007)。暦日は各値の `.toPlainDate()` (値自身の
 * ゾーン) で比べる。
 * - 単一日: "2026.01.01"
 * - 同一年月: "2026.01.01-3" (to の日は 0 埋めしない)
 * - 同一年: "2026.01.31-02.03"
 * - それ以外: "2026.12.31-2027.01.03"
 */
export const formatDateRange = (date: DateRange): string => {
  const from = date.from.toPlainDate();
  const to = date.to.toPlainDate();
  const fromStr = `${from.year}.${pad2(from.month)}.${pad2(from.day)}`;

  if (from.equals(to)) {
    return fromStr;
  }

  if (from.year === to.year && from.month === to.month) {
    return `${fromStr}-${to.day}`;
  }

  if (from.year === to.year) {
    return `${fromStr}-${pad2(to.month)}.${pad2(to.day)}`;
  }

  return `${fromStr}-${to.year}.${pad2(to.month)}.${pad2(to.day)}`;
};

/**
 * ED の RIDING TIME 欄の書式 (ADR-0007)。`H:MM` (時は 0 埋めしない、分は
 * 2 桁)。24 時間超は時が 24 以上になる。
 */
export const formatRidingTime = (duration: Temporal.Duration): string => {
  const totalMinutes = duration.total({ unit: "minutes" });
  const hours = Math.trunc(totalMinutes / 60);
  const minutes = Math.trunc(totalMinutes % 60);

  return `${hours}:${pad2(minutes)}`;
};
