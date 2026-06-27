FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

ENV PATH="/root/.local/bin:${PATH}"
ENV DBUS_SESSION_BUS_ADDRESS="unix:path=/dev/null"

# Install system dependencies, AGY CLI, and pnpm in one layer to keep size clean
RUN apt-get update && \
    apt-get install -y curl ca-certificates && \
    curl -fsSL https://antigravity.google/cli/install.sh | bash && \
    npm install -g pnpm && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install project dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build the project
RUN npx tsc

# Set default start command
CMD ["node", "dist/index.js"]
