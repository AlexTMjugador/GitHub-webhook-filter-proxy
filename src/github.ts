import hexToArrayBuffer from "hex-to-array-buffer";

// A list of GitHub webhook event names.
//
// Extracted from <https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads>
// on September 29th, 2022, excluding beta events.
const GITHUB_EVENT_NAMES = [
  "BRANCH_PROTECTION_RULE",
  "CHECK_RUN",
  "CHECK_SUITE",
  "CODE_SCANNING_ALERT",
  "COMMIT_COMMENT",
  "CREATE",
  "DELETE",
  "DEPLOY_KEY",
  "DEPLOYMENT",
  "DEPLOYMENT_STATUS",
  "DISCUSSION",
  "DISCUSSION_COMMENT",
  "FORK",
  "GITHUB_APP_AUTHORIZATION",
  "GOLLUM",
  "INSTALLATION",
  "INSTALLATION_REPOSITORIES",
  "ISSUE_COMMENT",
  "ISSUES",
  "LABEL",
  "MARKETPLACE_PURCHASE",
  "MEMBER",
  "MEMBERSHIP",
  "META",
  "MILESTONE",
  "ORGANIZATION",
  "ORG_BLOCK",
  "PACKAGE",
  "PAGE_BUILD",
  "PING",
  "PROJECT",
  "PROJECT_CARD",
  "PROJECT_COLUMN",
  "PUBLIC",
  "PULL_REQUEST",
  "PULL_REQUEST_REVIEW",
  "PULL_REQUEST_REVIEW_COMMENT",
  "PULL_REQUEST_REVIEW_THREAD",
  "PUSH",
  "RELEASE",
  "REPOSITORY_DISPATCH",
  "REPOSITORY",
  "REPOSITORY_IMPORT",
  "REPOSITORY_VULNERABILITY_ALERT",
  "SECURITY_ADVISORY",
  "SPONSORSHIP",
  "STAR",
  "STATUS",
  "TEAM",
  "TEAM_ADD",
  "WATCH",
  "WORKFLOW_DISPATCH",
  "WORKFLOW_JOB",
  "WORKFLOW_RUN",
] as const;

// Represents a valid, recognized GitHub webhook event name.
export type GitHubEventName = (typeof GITHUB_EVENT_NAMES)[number];

// Verifies whether the payload of this webhook request was signed
// by GitHub, using some shared `secret_token`. If this verification
// passes, the request is authenticated as coming from a GitHub server.
export async function verifyGitHubWebhookSignature(
  secretToken: string,
  requestHeaders: Headers,
  payload: string,
) {
  // The Cloudflare Workers TextEncoder always uses UTF-8
  const textEncoder = new TextEncoder();

  return crypto.subtle.verify(
    "HMAC",
    await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(secretToken),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["verify"],
    ),
    // GitHub prefixes the hexadecimal representation of the signature with "sha256=".
    // Remove that and convert the hexadecimal string back to the raw bytes that this function expects
    hexToArrayBuffer(
      requestHeaders.get("X-Hub-Signature-256")?.replace(/^sha256=/, "") ?? "",
    ),
    textEncoder.encode(payload),
  );
}

// Returns the GitHub webhook event name specified in the request headers as-is,
// if any.
export function getRawGitHubEventName(requestHeaders: Headers) {
  return requestHeaders.get("X-GitHub-Event");
}

// Returns the GitHub webhook event name in a strongly-typed form. `undefined`
// will be returned if there is no event name in the request headers, or if it
// did not match any recognized event.
export function getGitHubEventName(requestHeaders: Headers) {
  const eventName = getRawGitHubEventName(requestHeaders)?.toUpperCase();

  return GITHUB_EVENT_NAMES.find(
    (validEventName) => validEventName === eventName,
  );
}
