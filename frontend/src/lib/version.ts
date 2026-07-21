// Build-time commit identification.
//
// NEXT_PUBLIC_GIT_COMMIT_SHA is inlined into the client bundle by Next.js at
// `next build` time. CI (build.yml) passes github.sha as a Docker build arg
// which the Dockerfile sets as ENV before the build step. In local dev the var
// is undefined and the functions below return null, so the UI hides the link.

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
    // 7 chars is GitHub's own short-SHA width and unambiguous in practice.
    short: COMMIT_SHA.slice(0, 7),
    url: `${REPO_URL}/commit/${COMMIT_SHA}`,
  };
}
