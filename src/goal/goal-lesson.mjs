// V9 learning: human-authored outcome lessons. Agents cannot author lessons
// (human sovereignty, same rule as goals); retrieval filters by verdict.
const VERDICTS = Object.freeze(['success', 'failure', 'partial']);

export function createLesson({ id, missionId, verdict, lesson, by, goalId } = {}) {
  if (!by || typeof by !== 'string' || by.startsWith('agent:')) {
    throw new Error('lesson_by_must_be_human');
  }
  if (!VERDICTS.includes(verdict)) {
    throw new Error(`lesson_verdict_must_be_one_of:${VERDICTS.join(',')}`);
  }
  if (!lesson || typeof lesson !== 'string' || !lesson.trim()) {
    throw new Error('lesson_text_required');
  }
  return Object.freeze({
    id: id ?? `les_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    missionId: missionId || null,
    goalId: goalId || null,
    verdict,
    lesson: lesson.trim(),
    by,
    recordedAt: new Date().toISOString(),
  });
}
