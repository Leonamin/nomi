/** The multi-shot top candidate mirrors one real row; candidate IDs are not shot IDs. */
export function generationCandidateOwnerShot<T extends { shotId: string; candidate: { candidateId: string } }>(
  plan: { candidate: { candidateId: string }; shots?: readonly T[] }, shotId?: string,
): T | undefined {
  if (!plan.shots?.length) return undefined
  const matches = plan.shots.filter(shot => shotId ? shot.shotId === shotId : shot.candidate.candidateId === plan.candidate.candidateId)
  if (matches.length !== 1) throw new Error('generation_candidate_owner_ambiguous_or_missing')
  return matches[0]
}
