export function formatDateTime(value: unknown) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}
