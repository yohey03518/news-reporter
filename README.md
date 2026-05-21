# News Reporter

A TypeScript console application that scrapes articles from PressPlay, summarizes them using the local Gemini CLI, and sends the summary to multiple LINE users.

## Prerequisites

- [pnpm](https://pnpm.io/)
- [Playwright](https://playwright.dev/)
- [Gemini CLI](https://github.com/google/gemini-cli) (installed and configured locally)
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
5. Provide the generated code to Gemini CLI to integrate it into the project.

### Phase 2: Run the application

(Instructions will be updated after implementation)
