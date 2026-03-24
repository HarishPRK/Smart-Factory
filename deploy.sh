#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------
# deploy.sh - Build and deploy Smart Factory SPA to EC2
#
# Usage:
#   ./deploy.sh <ec2-user@ec2-host> [ssh-key-path]
#
# Examples:
#   ./deploy.sh ec2-user@ec2-3-15-42-100.us-east-2.compute.amazonaws.com
#   ./deploy.sh ec2-user@54.123.45.67 ~/.ssh/my-ec2-key.pem
# ------------------------------------------------------------------

EC2_HOST="${1:?Usage: ./deploy.sh <ec2-user@ec2-host> [ssh-key-path]}"
SSH_KEY="${2:-}"
REMOTE_DIR="/var/www/smart-factory"
STAGING_DIR="~/smart-factory-dist"

# Build SSH/SCP options
SSH_OPTS="-o StrictHostKeyChecking=accept-new"
if [ -n "$SSH_KEY" ]; then
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

echo "==> Step 1: Building production bundle..."
npm run build

echo "==> Step 2: Uploading dist/ to ${EC2_HOST}:${REMOTE_DIR}..."
ssh $SSH_OPTS "$EC2_HOST" "mkdir -p ${STAGING_DIR}"

if command -v rsync &> /dev/null; then
    rsync -avz --delete \
        -e "ssh $SSH_OPTS" \
        dist/ "${EC2_HOST}:${STAGING_DIR}/"
else
    scp $SSH_OPTS -r dist/* "${EC2_HOST}:${STAGING_DIR}/"
fi

echo "==> Step 3: Moving files to web root and setting ownership..."
ssh $SSH_OPTS "$EC2_HOST" "
    sudo mkdir -p ${REMOTE_DIR}
    sudo rsync -a --delete ${STAGING_DIR}/ ${REMOTE_DIR}/ 2>/dev/null || \
        (sudo rm -rf ${REMOTE_DIR}/* && sudo cp -r ${STAGING_DIR}/* ${REMOTE_DIR}/)
    rm -rf ${STAGING_DIR}
    sudo chown -R nginx:nginx ${REMOTE_DIR}
"

echo "==> Step 4: Reloading Nginx..."
ssh $SSH_OPTS "$EC2_HOST" "sudo nginx -t && sudo systemctl reload nginx"

# Extract hostname for the final URL
HOST_PART=$(echo "$EC2_HOST" | cut -d@ -f2)
echo "==> Done! Site is live at http://${HOST_PART}"
