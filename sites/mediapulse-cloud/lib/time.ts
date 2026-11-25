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
