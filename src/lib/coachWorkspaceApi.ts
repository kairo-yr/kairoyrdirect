import { getBatchesByAcademy, getBatchesByCoach, getBatchStudents, type Batch } from './batchApi';

export type CoachWorkspaceBatch = {
  id: string;
  name: string;
  coachId: string | null;
  coachName: string;
  studentIds: string[];
  status: 'active';
};

export type CoachWorkspaceStudent = {
  id: string;
  name: string;
  status: string;
};

function buildWorkspace(batches: Batch[], assignments: Awaited<ReturnType<typeof getBatchStudents>>[]) {
  const students = new Map<string, CoachWorkspaceStudent>();
  const workspaceBatches = batches.map((batch, index): CoachWorkspaceBatch => {
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
      coachId: batch.primary_coach_id,
      coachName: batch.primary_coach?.full_name ?? 'Not assigned',
      studentIds: activeAssignments.map((assignment) => assignment.student_id),
      status: 'active',
    };
  });
  return { batches: workspaceBatches, students: Array.from(students.values()) };
}

export async function getAcademyWorkspace(academyId: string) {
  const activeBatches = (await getBatchesByAcademy(academyId)).filter((batch) => batch.status === 'active');
  const assignments = await Promise.all(activeBatches.map((batch) => getBatchStudents(batch.id)));
  return buildWorkspace(activeBatches, assignments);
}

export async function getCoachWorkspace(coachId: string, academyId: string) {
  const assignedBatches = (await getBatchesByCoach(coachId))
    .filter((batch) => batch.academy_id === academyId && batch.status === 'active');
  const assignments = await Promise.all(assignedBatches.map((batch) => getBatchStudents(batch.id)));
  return buildWorkspace(assignedBatches, assignments);
}
