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

## Project Structure

- `src/index.ts`: Main orchestrator.
- `src/scraper.ts`: Playwright logic for scraping PressPlay.
- `src/summarizer.ts`: Wrapper for local AGY CLI calls.
- `src/lineClient.ts`: LINE Messaging API client.
- `src/config.ts`: Configuration and environment variable validation.
