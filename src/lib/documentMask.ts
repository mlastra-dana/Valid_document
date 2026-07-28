export const maskDocumentNumber = (value?: string | null): string => {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  const first = normalized.slice(0, 1);
  const last = normalized.slice(-2);
  const maskLength = Math.max(normalized.length - 3, 3);
  return `${first}${"*".repeat(maskLength)}${last}`;
};
