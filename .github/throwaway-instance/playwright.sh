#!/usr/bin/env bash
# Runs a command in the Playwright image the suite's other workflows run their jobs in (its browsers
# come installed: downloading them on a hosted runner stalls), on the runner's own network, so the
# browser reaches the throwaway Fleet at localhost:8080. This job can't be a container job itself: it
# drives Docker, kind and Compose on the runner.
#
#   .github/throwaway-instance/playwright.sh npm ci
#   .github/throwaway-instance/playwright.sh npx playwright test --project=throwaway --reporter=github,blob
#
# The workspace is mounted at its own path, so the reports name files where the runner has them, and
# the container runs as the runner's user, so what it writes stays the runner's to clean up.
set -euo pipefail

# The same image as playwright-free.yml and playwright-premium.yml: keep it in step with them and
# with @playwright/test in playwright/package.json.
image=mcr.microsoft.com/playwright:v1.61.1-noble

exec docker run --rm --network host --ipc host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e CI=true -e SUITE=throwaway -e GITHUB_RUN_ID \
  -e FLEET_URL -e FLEET_ADMIN_EMAIL -e FLEET_ADMIN_PASSWORD -e FLEET_API_TOKEN -e THROWAWAY_HOSTS \
  -e PLAYWRIGHT_BLOB_OUTPUT_DIR -e PLAYWRIGHT_JSON_OUTPUT_FILE \
  -v "$GITHUB_WORKSPACE:$GITHUB_WORKSPACE" -w "$GITHUB_WORKSPACE/playwright" \
  "$image" "$@"
