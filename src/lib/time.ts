export function vietnamTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Thời gian không hợp lệ");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return {
    postDate: `${get("year")}-${get("month")}-${get("day")}`,
    postHour: Number(get("hour")),
  };
}
export const todayVN = () => vietnamTime(new Date()).postDate;
export const shiftDay = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const engagement = (p: {
  likes: number;
  comments: number;
  shares: number;
}) => p.likes + p.comments + p.shares;

export function syncWindow(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error("Ngày đồng bộ không hợp lệ");
  return {
    date,
    since: String(Date.parse(`${date}T00:00:00+07:00`) / 1000),
    until: String(Date.parse(`${shiftDay(date, 1)}T00:00:00+07:00`) / 1000),
  };
}
export function dateSynced(
  page: { lastSync: string | null; syncedDates?: string[]; fullSync?: boolean },
  date: string,
) {
  return (
    !!page.lastSync &&
    (page.fullSync === true ||
      page.syncedDates?.includes(date) === true ||
      page.syncedDates === undefined)
  );
}
