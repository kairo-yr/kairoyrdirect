export type HomeworkStatus = 'draft' | 'published' | 'closed' | 'cancelled';
export type AssignmentStatus = 'assigned' | 'opened' | 'in_progress' | 'submitted' | 'needs_review' | 'completed' | 'needs_correction' | 'overdue' | 'completed_late' | 'excused' | 'cancelled';
export type TaskStatus = 'assigned' | 'opened' | 'in_progress' | 'submitted' | 'needs_review' | 'completed' | 'needs_correction' | 'excused' | 'cancelled';
export type HomeworkTaskType = 'custom' | 'external_link' | 'written_answer' | 'game_submission' | 'offline_practice';
export type SubmissionType = 'self_confirm' | 'written_text' | 'external_url' | 'pgn_text' | 'file_upload' | 'none';

export type HomeworkTask = {
  id: string; homework_id: string; task_order: number; task_type: HomeworkTaskType; title: string;
  instructions: string | null; external_url: string | null; submission_type: SubmissionType;
  requires_review: boolean; is_required: boolean; completion_config: Record<string, unknown>;
};

export type Homework = {
  id: string; academy_id: string; batch_id: string; class_report_id: string | null; created_by: string;
  created_by_role: string; title: string; instructions: string | null; parent_note: string | null;
  assigned_date: string; due_date: string; status: HomeworkStatus; public_code: string;
  published_at: string | null; cancelled_at: string | null; created_at: string; updated_at: string;
  batch?: { id: string; name: string; primary_coach?: { full_name: string } | null } | null;
  creator?: { full_name: string | null } | null; homework_tasks?: HomeworkTask[];
  student_homework_assignments?: StudentHomeworkAssignment[];
};

export type TaskProgress = {
  id: string; student_homework_assignment_id: string; homework_task_id: string; status: TaskStatus;
  submission_text: string | null; submission_url: string | null; submission_pgn: string | null;
  submitted_at: string | null; completed_at: string | null; reviewed_at: string | null;
  review_status: string | null; coach_feedback: string | null; homework_task?: HomeworkTask | null;
};

export type StudentHomeworkAssignment = {
  id: string; homework_id: string; academy_id: string; batch_id: string; student_id: string;
  status: AssignmentStatus; assigned_at: string; first_opened_at: string | null; submitted_at: string | null;
  completed_at: string | null; last_activity_at: string | null; is_late: boolean; coach_feedback: string | null;
  student?: { id: string; full_name: string } | null; homework?: Homework | null;
  student_homework_task_progress?: TaskProgress[];
};

export type HomeworkDraftInput = {
  id?: string; academyId: string; batchId: string; classReportId?: string | null; title: string;
  instructions?: string | null; parentNote?: string | null; assignedDate: string; dueDate: string;
  tasks: Array<Omit<HomeworkTask, 'id' | 'homework_id'>>; excludedStudentIds: string[];
};
