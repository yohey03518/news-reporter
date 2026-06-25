#!/bin/bash
export HOME="/Users/erwin.chang"
# Ensure pnpm, node, and agy are in the PATH (especially for cron)
export PATH="/Users/erwin.chang/.local/bin:/Users/erwin.chang/.nvm/versions/node/v24.11.1/bin:$PATH"
#export PATH="/Users/erwin.chang/.nvm/versions/node/v24.11.1/bin:$PATH"

# Navigate to the script's directory
cd "/Users/erwin.chang/git/news-reporter"

# Run the application using pnpm start
pnpm start
