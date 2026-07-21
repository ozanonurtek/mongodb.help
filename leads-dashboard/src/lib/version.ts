// Build-time commit identification. Mirrors the frontend's version.ts; the
// SHA is baked by CI (build.yml) via a Docker build arg that the Dockerfile
// sets as NEXT_PUBLIC_GIT_COMMIT_SHA before `next build`. Empty in local dev.

const COMMIT_SHA = process.env.NEXT_PUBLIC_GIT_COMMIT_SHA;

export const REPO_URL = "https://github.com/ozanonurtek/mongodb.help";

export type CommitInfo = {
  sha: string;
  short: string;
  url: string;
};

export function getCommitInfo(): CommitInfo | null {
  if (!COMMIT_SHA) return null;
  return {
    sha: COMMIT_SHA,
    short: COMMIT_SHA.slice(0, 7),
    url: `${REPO_URL}/commit/${COMMIT_SHA}`,
  };
}
