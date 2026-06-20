export function formatFirestoreDate(value: unknown) {
  if (!value) return 'Not available';
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(value.toDate());
  }
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
  }
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
    }
  }
  return 'Not available';
}
