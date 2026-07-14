export type HomeworkWhatsAppMessageInput = {
  title: string; batchName: string; coachName?: string | null; assignedDate: string; dueDate: string;
  instructions?: string | null; taskSummaries: string[]; parentNote?: string | null; homeworkUrl: string;
};

const readableDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));

export function generateHomeworkWhatsAppMessage(input: HomeworkWhatsAppMessageInput) {
  const tasks = input.taskSummaries.map((task) => `• ${task}`).join('\n');
  return [`♟️ *Chess Homework*`, ``, `📚 *Batch:* ${input.batchName}`, `📝 *Homework:* ${input.title}`, `📅 *Complete Before:* ${readableDate(input.dueDate)}`, ``, `*Tasks*`, tasks, input.instructions ? `\n${input.instructions}` : '', ``, `🔗 *Open Homework*`, input.homeworkUrl, input.parentNote ? `\n${input.parentNote}` : `\nParents are requested to help students complete the homework before the due date.`, ``, `Thank you.`, `*Kairoyr Direct*`].filter((line) => line !== '').join('\n');
}

export function generateHomeworkReminder(input: { title: string; dueDate: string; homeworkUrl: string; studentName?: string; status?: string }) {
  if (input.studentName) return [`Hello,`, ``, `This is a reminder that ${input.studentName}’s chess homework is still incomplete.`, ``, `📝 *Homework:* ${input.title}`, `📅 *Due:* ${readableDate(input.dueDate)}`, input.status ? `📊 *Status:* ${input.status.replaceAll('_', ' ')}` : '', ``, `Please help your child complete it before the due date.`, ``, `🔗 ${input.homeworkUrl}`, ``, `Thank you.`].filter(Boolean).join('\n');
  return [`♟️ *Chess Homework Reminder*`, ``, `A reminder to complete the assigned chess homework before the due date.`, ``, `📝 *Homework:* ${input.title}`, `📅 *Due:* ${readableDate(input.dueDate)}`, ``, `🔗 *Open Homework*`, input.homeworkUrl, ``, `Parents are requested to check the student dashboard and help their child complete any pending tasks.`, ``, `Thank you.`].join('\n');
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement('textarea'); textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
  document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
}
