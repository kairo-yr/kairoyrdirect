import { getBatchesByCoach, getBatchStudents } from './batchApi';

export type CoachWorkspaceBatch = {
  id: string;
  name: string;
  coachId: string;
  coachName: string;
  studentIds: string[];
  status: 'active';
};

export type CoachWorkspaceStudent = {
  id: string;
  name: string;
  status: string;
};

export async function getCoachWorkspace(coachId: string, academyId: string) {
  const assignedBatches = (await getBatchesByCoach(coachId))
    .filter((batch) => batch.academy_id === academyId && batch.status === 'active');
  const assignments = await Promise.all(assignedBatches.map((batch) => getBatchStudents(batch.id)));
  const students = new Map<string, CoachWorkspaceStudent>();

  const batches = assignedBatches.map((batch, index): CoachWorkspaceBatch => {
    const activeAssignments = assignments[index].filter((assignment) => assignment.student?.status === 'active');
    activeAssignments.forEach((assignment) => {
      if (!assignment.student) return;
      students.set(assignment.student.id, {
        id: assignment.student.id,
        name: assignment.student.full_name,
        status: assignment.student.status,
      });
    });

    return {
      id: batch.id,
      name: batch.name,
      coachId,
      coachName: batch.primary_coach?.full_name ?? 'Assigned coach',
      studentIds: activeAssignments.map((assignment) => assignment.student_id),
      status: 'active',
    };
  });

  return { batches, students: Array.from(students.values()) };
}
