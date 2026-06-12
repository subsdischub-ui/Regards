// Word-boundary matching so real names are never flagged: "Sophie E2E" and
// "Test User" match, but "Testard" or "Détestable" do not. The E2E suite
// registers guests as "<Prénom> E2E" (see tests/e2e/regards.spec.ts).
const TEST_NAME_RE = /(^|[^\p{L}])(e2e|test)([^\p{L}]|$)/iu;

export function isTestGuestName(name: string): boolean {
  return TEST_NAME_RE.test(name);
}
