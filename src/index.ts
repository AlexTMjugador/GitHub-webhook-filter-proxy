import {
  getGitHubEventName,
  getRawGitHubEventName,
  GitHubEventName,
  verifyGitHubWebhookSignature,
} from "./github";

// A HTTP status code this worker may include in its responses.
enum ResponseCode {
  ACCEPTED = 202,
  BAD_REQUEST = 400,
  FORBIDDEN = 403,
  UNSUPPORTED_MEDIA_TYPE = 415,
  INTERNAL_SERVER_ERROR = 500,
}

// A settings key whose value contains the regular expression to
// for matching the payloads of some event type.
type EventMatchRegexKey = `${GitHubEventName}_EVENT_MATCH_REGEX`;

// A settings key whose value indicates whether to relay or drop
// this event to the target (proxied) URL.
type EventMatchActionKey = `${GitHubEventName}_EVENT_MATCH_ACTION`;

// An action this proxy can do with an event: relay it to a target
// URL or drop it.
type EventAction = "relay" | "drop";

// Represents all the possible settings for this proxy. Editing
// this type usually requires editing user documentation too.
type Settings = {
  [key in `${EventMatchRegexKey}`]?: string;
} & { [key in `${EventMatchActionKey}`]?: EventAction } & {
  SECRET_TOKEN: string;
  TARGET_URL: string;
  UNMATCHED_EVENT_ACTION?: EventAction;
};

export default {
  async fetch(
    request: Request,
    env: Settings,
    _ctx: ExecutionContext
  ): Promise<Response> {
    // First, do some quick sanity checks for the request
    if (request.method != "POST") {
      return new Response("Unexpected HTTP method", {
        status: ResponseCode.BAD_REQUEST,
        headers: { Allow: "POST" },
      });
    }

    if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
      return new Response(
        "Missing or bad content type header for a JSON payload",
        { status: ResponseCode.UNSUPPORTED_MEDIA_TYPE }
      );
    }

    const eventName = getGitHubEventName(request.headers);
    if (!eventName) {
      return new Response(
        `Missing, invalid or unrecognized event name: ${getRawGitHubEventName(
          request.headers
        )}`,
        {
          status: ResponseCode.BAD_REQUEST,
        }
      );
    }

    // Try to get plain text from the body. This can fail if the body is binary data
    // that cannot be decoded as UTF-8
    let requestBody;
    try {
      requestBody = await request.text();
    } catch (e) {
      return new Response("The request body is not valid text", {
        status: ResponseCode.BAD_REQUEST,
      });
    }

    // Reject unsigned or badly signed requests, so our proxy will only accept
    // requests coming from GitHub or some other party that knows a shared secret
    try {
      const isWebhookSignatureValid = await verifyGitHubWebhookSignature(
        env.SECRET_TOKEN,
        request.headers,
        requestBody
      );

      if (isWebhookSignatureValid) {
        return new Response("Missing or invalid GitHub webhook signature", {
          status: ResponseCode.FORBIDDEN,
        });
      }
    } catch (e) {
      return new Response(`Crypto error (bad worker configuration?): ${e}`, {
        status: ResponseCode.INTERNAL_SERVER_ERROR,
      });
    }

    // Validate the JSON in the request body and minify it to a consistent format,
    // to reduce the fragility of regular expressions
    let normalizedWebhookEventBody;
    try {
      normalizedWebhookEventBody = JSON.stringify(JSON.parse(requestBody));

      console.debug(
        `Received ${eventName} event: ${normalizedWebhookEventBody}`
      );
    } catch (e) {
      return new Response(`JSON parse error: ${e}`, {
        status: ResponseCode.BAD_REQUEST,
      });
    }

    // Check whether the event body matches some configured regex
    let eventBodyMatches;
    let eventMatches;
    if (`${eventName}_EVENT_MATCH_REGEX` in env) {
      eventBodyMatches = normalizedWebhookEventBody.match(
        env[`${eventName}_EVENT_MATCH_REGEX`]!
      );
      eventMatches = true;
    } else {
      eventBodyMatches = false;
      eventMatches = false;
    }

    let eventAction: EventAction;
    if (eventMatches) {
      // We have some regex for this event that we checked. It either could match or not

      if (eventBodyMatches) {
        // The body matched the configured regex. Run the configured action for a match,
        // defaulting to "drop"

        eventAction = env[`${eventName}_EVENT_MATCH_ACTION`] ?? "drop";

        console.debug(
          `Event ${eventName} matched the configured regex. Filtering action: ${eventAction}`
        );
      } else {
        // The body did not match the configured regex. Invert the configured action for
        // a match, defaulting to "relay"

        const matchAction = env[`${eventName}_EVENT_MATCH_ACTION`];
        eventAction = matchAction === "drop" ? "relay" : "drop";

        console.debug(
          `Event ${eventName} did not match the configured regex. Filtering action: ${eventAction}`
        );
      }
    } else {
      // We do not have a regex for this event. Fallback to the default action, or "drop"
      // if it is not set

      eventAction = env.UNMATCHED_EVENT_ACTION ?? "drop";

      console.debug(
        `Event ${eventName} did not match any configured regex. Filtering action: ${eventAction}`
      );
    }

    if (eventAction == "relay") {
      // Relay the request we've received as-is, barring some additional headers added by Cloudflare
      try {
        return await fetch(
          new Request(env.TARGET_URL, {
            method: request.method,
            headers: request.headers,
            body: requestBody,
          })
        );
      } catch (e) {
        return new Response(`Could not deliver event to target URL: ${e}`, {
          status: ResponseCode.INTERNAL_SERVER_ERROR,
        });
      }
    } else {
      // Let GitHub know that the event was delivered, but we've filtered it
      return new Response("Filtered", { status: ResponseCode.ACCEPTED });
    }
  },
};
