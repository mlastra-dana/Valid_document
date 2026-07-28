export const formatDateTime = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(date);
};
