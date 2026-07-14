export type WhatsAppClassReportInput = {
  date: string;
  studentsPresent: string[] | null;
  topics: string[] | string;
  studyDetails: string;
  homeworkLink?: string | null;
  batchName?: string | null;
  academyName?: string | null;
  coachName?: string | null;
};

function cleanText(value: string) {
  return value.trim().replace(/\r\n/g, '\n').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
}

function formatDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value.trim());
  if (!match) return cleanText(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return cleanText(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function normalizeTopics(topics: string[] | string) {
  let values: string[] | null = Array.isArray(topics) ? topics : null;
  if (!values) {
    const cleaned = cleanText(typeof topics === 'string' ? topics : '');
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      try {
        const parsed: unknown = JSON.parse(cleaned);
        if (Array.isArray(parsed)) values = parsed.filter((item): item is string => typeof item === 'string');
      } catch {
        // Keep malformed or ordinary bracketed text as the coach entered it.
      }
    }
    if (!values) return cleaned;
  }
  return values.map(cleanText).filter(Boolean).map((topic) => `• ${topic}`).join('\n');
}

function isValidHomeworkLink(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function findHomeworkLink(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s<>]+/i);
  if (!match) return null;
  const candidate = match[0].replace(/[),.;!?]+$/, '');
  return isValidHomeworkLink(candidate) ? candidate : null;
}

export function generateClassReportWhatsAppMessage(report: WhatsAppClassReportInput): string {
  const students = report.studentsPresent === null
    ? 'Students recorded in the class report'
    : report.studentsPresent.map(cleanText).filter(Boolean).join(', ') || 'No students marked present';
  const headingDetails = [
    report.academyName ? `🏫 *Academy:* ${cleanText(report.academyName)}` : '',
    report.batchName ? `🏫 *Batch:* ${cleanText(report.batchName)}` : '',
    `📅 *Date:* ${formatDateOnly(report.date)}`,
    report.coachName ? `👨‍🏫 *Coach:* ${cleanText(report.coachName)}` : '',
    `👥 *Students Present:* ${students}`,
  ].filter(Boolean).join('\n');
  const sections = [
    '♟️ *Chess Class Report*',
    headingDetails,
    `📚 *Topics Covered*\n${normalizeTopics(report.topics)}`,
    `📝 *Class Details*\n${cleanText(report.studyDetails)}`,
  ];

  if (isValidHomeworkLink(report.homeworkLink)) {
    sections.push(`🏠 *Homework*\n${report.homeworkLink.trim()}`);
  }
  sections.push('Thank you.\n*Kairoyr Direct*');
  return sections.join('\n\n');
}
