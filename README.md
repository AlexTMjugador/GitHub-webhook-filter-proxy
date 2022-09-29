<div align="center">
<h1>GitHub webhook filter proxy</h1>

<i>A serverless, easy-to-setup GitHub webhook filtering proxy that relays or drops events when they match configurable regular expressions, powered by Cloudflare Workers.</i>

<a href="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/actions?query=workflow%3ACI"><img
alt="CI workflow status" src="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/actions/workflows/ci.yml/badge.svg"></a>
<a href="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/actions?query=workflow%3A%22Deploy+to+Cloudflare+Workers%22"><img alt="Deploy workflow status" src="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/actions/workflows/deploy.yml/badge.svg"></a>
</div>

- [💡 Background](#-background)
	- [Use cases](#use-cases)
- [✨ Quickstart](#-quickstart)
- [⚙️ Configuration](#️-configuration)
	- [`SECRET_TOKEN`](#secret_token)
	- [`TARGET_URL`](#target_url)
	- [`UNMATCHED_EVENT_ACTION`](#unmatched_event_action)
	- [`<EVENT NAME>_EVENT_MATCH_REGEX`](#event-name_event_match_regex)
	- [`<EVENT NAME>_EVENT_MATCH_ACTION`](#event-name_event_match_action)
	- [Configuration via files](#configuration-via-files)
	- [Examples](#examples)
- [❤️ Contributing](#️-contributing)
- [🤝 Contact](#-contact)
- [🧑‍🤝‍🧑 Contributors](#-contributors)

# 💡 Background

GitHub supports sending HTTP POST requests to an arbitrary server in response to events on the platform, known as [_webhooks_](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks), to notify external services about them. They are particularly useful for integrating with GitHub.

However, while GitHub lets users select what types of events trigger a webhook, it does not offer any functionality for filtering events by more fine-grained conditions. For example, when a webhook is triggered by a `push` event, it is triggered for a `push` in any branch, even if the service is only interested in a single branch.

This behavior can be undesirable: it wastes traffic for would-be-ignored events, and several external services, which in some cases are not controlled by the end user, may not offer any filtering features, triggering superfluous actions.

This project offers an easy-to-setup, flexible proxy that anyone can use to drop events before they are delivered to the actual external service, as if they never were triggered. GitHub can be configured to deliver events to this proxy, which then decides to relay the event to the external service or drop it, based on whether the event JSON body matches a regular expression.

## Use cases

This proxy is helpful for chores such as:

- **Limiting what pull requests and branches send chat notifications on Discord or Slack**. Get rid of the notification spam caused by automation tools, such as Dependabot or Renovate, and focus on worthwhile events!
- **Enforcing event sender authentication**. [GitHub can sign webhook requests with a shared secret](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks), and this proxy expects and verifies that signature. Rest assured knowing that every event relayed by this proxy comes from GitHub.
- **Working around a lack of event filtering features**. Trigger deployments, continuous integration, and similar tasks only for a subset of events, even if the external service does not support that.
- **Reducing the load on an overwhelmed service**.

# ✨ Quickstart

The easiest way to get started is to fork this repository and deploy it to your [Cloudflare](https://www.cloudflare.com) account. There are step-by-step instructions to do that below. It's free, and it will only take you a few minutes!

1. Click the button below. Follow the instructions that appear.

<p align="center">
<a href="https://deploy.workers.cloudflare.com/?url=https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy"><img
alt="Deploy to Cloudflare Workers" src="https://deploy.workers.cloudflare.com/button"></a>
</p>

> **Note**: Cloudflare will ask you for an API token, which you will need to create if you don't have one yet. The "Edit Cloudflare Workers" template generates API tokens suitable for deploying this proxy.

2. If everything goes well, you will be greeted with the following screen, and the worker will be deployed. Click the "Worker dash" button.

<p align="center">
<img alt="Cloudflare Workers deployment screen" src="https://i.imgur.com/19LOr21.png">
</p>

3. Find your way to the "Settings" tab of the worker you've just deployed, at Workers › `github-webhook-filter-proxy`. Once there, go to the "Variables" section and add a new environment variable by clicking "Add variable".

<p align="center">
<img alt="Worker variables screen" src="https://i.imgur.com/JMI5jXo.png">
</p>

4. As you may have guessed, the proxy is configured via environment variables. For now, we will set three environment variables:

- `SECRET_TOKEN`: a random, unique string that only GitHub and the proxy should know, used by the proxy to authenticate that events come from GitHub. Some ways of generating this token include running `echo "$(tr -dc _A-Z-a-z-0-9 < /dev/urandom | head -c32)"` on a Unix-like terminal, or using websites like [random.org](https://www.random.org/strings/?num=1&len=20&digits=on&upperalpha=on&loweralpha=on&unique=off&format=html&rnd=new). **Make sure to click the "Encrypt" button once you are done typing the token!**
- `TARGET_URL`: the URL to which the proxy will relay events that it does not drop. This is the URL of your target service (or another proxy, if you are into that).
- `UNMATCHED_EVENT_ACTION`: the action to perform when a regular expression match is not configured for an input event. The default is `drop`, so set it to `relay` to make the proxy send all the events it receives to the target URL.

Before clicking "Save" to apply the changes, the edition form should look like this:

<p align="center">
<img alt="Worker variables edition form preview" src="https://i.imgur.com/efGyZXO.png">
</p>

5. On GitHub, go to the corresponding webhooks settings page. Set the payload URL to the route of your worker, select `application/json` as "Content type", and type the same secret as in `SECRET_TOKEN`. If you are using the default `workers.dev` route, you can (and should) leave SSL verification enabled.

<p align="center">
<img alt="GitHub webhook configuration screen" src="https://i.imgur.com/NjGrdNL.png">
</p>

6. **The proxy is ready to rock!** 🎉 If you want to know what is going on, check out the "Recent deliveries" on GitHub and the worker logs on Cloudflare. The next section of this document describes the environment variables you can use to configure how it filters events.

# ⚙️ Configuration

The proxy can be configured via the following environment variables.

## `SECRET_TOKEN`

**Required**: yes

A random secret shared by GitHub and the proxy that is used to validate the digital signature that GitHub adds to the webhook event request.

The proxy expects and validates these signatures, so both GitHub and the proxy must be configured with the same value for this token.

## `TARGET_URL`

**Required**: yes

**Accepted values**: any HTTP(S) URL

The URL to which the proxy will relay events that it does not drop. This is the URL of the service that is being proxied.

## `UNMATCHED_EVENT_ACTION`

**Required**: no

**Accepted values**: `relay` or `drop`

**Default value**: `drop`

The action to perform when a regular expression match is not defined for an event. `drop` discards the event, while `relay` forwards the request to the target URL.

## `<EVENT NAME>_EVENT_MATCH_REGEX`

**Required**: no

**Accepted values**: a [JavaScript regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions), as a string

**Default value**: not defined

The regular expression to match against the JSON event payload for `<EVENT NAME>` events, where `<EVENT NAME>` is the name of a webhook event [listed in the GitHub documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads), converted to uppercase.

To increase robustness, the payload is minified before matching as if by the [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) function.

If a match occurs, the proxy will either relay or drop the event as defined by [`<EVENT NAME>_EVENT_MATCH_ACTION`](#event-name_event_match_action). If the payload does not match the regular expression, the proxy will take the opposite action to the one it would take if it matched (dropping instead of relaying, and vice versa).

## `<EVENT NAME>_EVENT_MATCH_ACTION`

**Required**: no

**Accepted values**: `relay` or `drop`

**Default value**: `drop`

The action to take when the regular expression defined by [`<EVENT NAME>_EVENT_MATCH_REGEX`](#event-name_event_match_regex) matches the JSON event payload.

## Configuration via files

The quickstart guide sets worker environment variables using the Cloudflare web dashboard. Nevertheless, it is also possible to configure them in the `wrangler.toml` file, which is the approach recommended by Cloudflare.

The Cloudflare documentation explains [how to set environment variables this way](https://developers.cloudflare.com/workers/platform/environment-variables/#environment-variables-via-wrangler), and describes [the `wrangler.toml` file format](https://developers.cloudflare.com/workers/wrangler/configuration). The [`wrangler.toml` file at this repository](https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/blob/master/wrangler.toml) contains comments that illustrate how it would be done.

## Examples

The next example variables configure the proxy to relay everything except push events made by bots or on branches managed by [Renovate](https://github.com/renovatebot/renovate).

- `PUSH_EVENT_MATCH_REGEX`: `(?:"ref":"refs\/heads\/renovate\/[^"]+")|(?:"login":"github-actions\[bot\]")`
- `PUSH_EVENT_MATCH_ACTION` (optional): `drop`
- `UNMATCHED_EVENT_ACTION`: `relay`

# ❤️ Contributing

Pull requests are accepted. Feel free to contribute if you can improve some aspect of the project!

Contributions include, but are not limited to:

- Writing good bug reports or feature requests.
- Sending a PR with code changes that implement an improvement or fix an issue.
- Recommending the project to others and engaging with the community.
- Economically supporting the project (check out the "Sponsor" button in the GitHub page).

Code contributions must pass CI checks and be deemed of enough quality by a repository maintainer to be merged.

The proxy source artifacts are structured as a standard `npm` project, coded in TypeScript. The [Wrangler](https://developers.cloudflare.com/workers/wrangler/get-started/) CLI tool is used for development and deployment. After the first `npm install`, the `npm run start` will launch the worker in a local server for development. Before committing any change, you should run ESlint and Prettier with `npm run lint` and `npm run format`, respectively.

# 🤝 Contact

We welcome friendly talk about the project, including questions, congratulations, and suggestions. Head to the [GitHub Discussions page](https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/discussions) to interact with fellow users, contributors and developers.

# 🧑‍🤝‍🧑 Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/AlexTMjugador"><img src="https://avatars.githubusercontent.com/u/7822554?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alejandro González</b></sub></a><br /><a href="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/commits?author=AlexTMjugador" title="Code">💻</a> <a href="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/commits?author=AlexTMjugador" title="Documentation">📖</a> <a href="#maintenance-AlexTMjugador" title="Maintenance">🚧</a> <a href="#projectManagement-AlexTMjugador" title="Project Management">📆</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
