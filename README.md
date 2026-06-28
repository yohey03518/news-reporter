# News Reporter

A TypeScript console application that scrapes articles from PressPlay, summarizes them using the local AGY CLI (`agy`), and sends the summary to multiple LINE users.

## Prerequisites

- [pnpm](https://pnpm.io/)
- [Playwright](https://playwright.dev/)
- [AGY CLI](https://antigravity.google/docs/cli) (installed and configured locally)
- LINE Channel Access Token

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   npx playwright install chromium
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your credentials.
   ```bash
   cp .env.example .env
   ```

## Usage

### Phase 1: Record Playwright Steps

Run the following command to open the Playwright recorder and generate the login/scraping steps:

```bash
npx playwright codegen https://www.pressplay.cc/
```

After recording:
1. Log in to PressPlay.
2. Navigate to today's article.
3. Extract the content.
4. Log out.
5. Provide the generated code to AGY CLI to integrate it into the project.

### Phase 2: Run the application

1. Ensure your `.env` file is fully populated with:
   - `PRESSPLAY_LOGIN_NAME`
   - `PRESSPLAY_PASSWORD`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_USER_IDS` (comma-separated)

2. Fill in your specific summary prompt in `src/summarizer.ts`.

3. Run the application:
   ```bash
   pnpm start
   ```

## Running with Docker (Linux/Ubuntu Host Only)

> [!NOTE]
> This Docker containerization setup is designed to run on a Linux/Ubuntu host (such as an Ubuntu Server) where the `agy` CLI is already authenticated on the host.
> 
> **Why Linux/Ubuntu only?**
> - On macOS, the host `agy` CLI stores its credentials inside the secure Apple Keychain, which the container cannot access.
> - On Linux/Ubuntu, `agy` stores its credentials as flat files inside `~/.gemini/`. Mounting this folder allows the containerized `agy` to reuse the host's authentication session directly.

### 1. Build the Docker Image

Run the following command from the project root directory:

```bash
docker build -t news-reporter .
```

### 2. Run the Docker Container

To run the container, you need to pass your environment variables and mount the host's `~/.gemini` folder (which contains the active OAuth session files) and the log folder:

```bash
docker run --env-file .env \
  -v ~/.gemini:/root/.gemini \
  -v $(pwd)/logs:/app/logs \
  news-reporter
```

*Note: Replace `~/.gemini` with the absolute path to the authenticated user's home `.gemini` folder on your server (e.g., `/home/ubuntu/.gemini`).*

**Volume Mappings & Arguments:**
- `--env-file .env`: Loads environment variables (like `PRESSPLAY_LOGIN_NAME`, `PRESSPLAY_PASSWORD`, `LOG_DIR`, `HEADLESS`, etc.) from your local `.env` file.
- `-v ~/.gemini:/root/.gemini`: Mounts the authenticated credentials from the host to `/root/.gemini` so `agy` inside the container inherits the login state.
- `-v $(pwd)/logs:/app/logs`: Mounts your local log directory to the container's log directory so that generated logs, screenshots, and cached prompt text files are persisted on your host machine.

### 3. Troubleshooting Docker Authentication

If the log shows that `agy` requires authentication:
1. Access the running container shell and run a dummy prompt to trigger authentication:
   ```bash
   docker exec -it jarvis-agent-1 agy -p "hello"
   ```
2. Open the URL printed on screen to authenticate with Google.
3. Paste the verification code into the prompt inside the container.
4. Once logged in successfully, restart or terminate the container to apply the changes:
   ```bash
   docker restart jarvis-agent-1
   ```

## Scheduling (macOS launchd)


On macOS the job must be scheduled with **launchd**, not `cron`. The schedule
(days/time) lives in `deploy/com.erwin.news-reporter.plist` under
`StartCalendarInterval` — edit it there, then re-run the deploy script.

### Why not cron

`agy` reads its OAuth credentials through the macOS **login Keychain** (the
`Antigravity Safe Storage` / `gemini` Keychain items), not just from
`~/.gemini/oauth_creds.json`. The `cron` daemon runs in a *separate security
session* that cannot reach the login Keychain, so `agy` thinks it is logged out
and demands re-login — even though running `agy` manually in a Terminal works
fine (your Terminal is inside the GUI login session, where the Keychain is
unlocked and reachable).

A **LaunchAgent** runs inside the user's GUI (Aqua) login session, so it inherits
Keychain access and `agy` stays authenticated. Setting `HOME`/`PATH` in `run.sh`
is necessary but **not sufficient** — the Keychain session is the real blocker.

> Requirement: you must be **logged in** to the Mac at trigger time (screen
> locked is OK; logged out or shut down is not).

### Deploy

The LaunchAgent definition is versioned at `deploy/com.erwin.news-reporter.plist`
and installed with `deploy/install-launchd.sh`. Run these from your normal
Terminal (so `launchctl` targets your own `gui/$(id -u)` login session):

```bash
# Install: copy plist into ~/Library/LaunchAgents, bootstrap it into your GUI
# session, and remove the old crontab entry (if any).
deploy/install-launchd.sh

# Verify it loaded
deploy/install-launchd.sh status

# Trigger one run now to confirm agy stays logged in
deploy/install-launchd.sh run
tail -f logs/cron.log

# Remove the schedule
deploy/install-launchd.sh uninstall
```

If a Keychain prompt ever appears on the first run, choose **Always Allow** to
add `agy` to the Keychain item's ACL.

## Project Structure

- `src/index.ts`: Main orchestrator.
- `src/scraper.ts`: Playwright logic for scraping PressPlay.
- `src/summarizer.ts`: Wrapper for local AGY CLI calls.
- `src/lineClient.ts`: LINE Messaging API client.
- `src/config.ts`: Configuration and environment variable validation.
