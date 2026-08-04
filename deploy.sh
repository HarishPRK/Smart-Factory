#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------
# deploy.sh - Build and deploy Smart Factory SPA + integration API to EC2
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
REMOTE_APP_DIR="/opt/smart-factory"
BACKEND_STAGING_DIR="~/smart-factory-backend"
CONFIG_STAGING_DIR="~/smart-factory-config"

# Build SSH/SCP options as an array so identity paths containing spaces remain
# one argument (common when the EC2 key was downloaded as "Smart Factory.pem").
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [ -n "$SSH_KEY" ]; then
    SSH_OPTS+=(-i "$SSH_KEY")
fi
printf -v RSYNC_SSH 'ssh'
for option in "${SSH_OPTS[@]}"; do
    printf -v quoted_option '%q' "$option"
    RSYNC_SSH+=" ${quoted_option}"
done

if [ "${SKIP_BUILD:-0}" = "1" ]; then
    echo "==> Step 1: Using the existing production bundle..."
else
    echo "==> Step 1: Building production bundle..."
    npm run build
fi

echo "==> Step 2: Uploading frontend and integration API..."
ssh "${SSH_OPTS[@]}" "$EC2_HOST" "
    mkdir -p ${STAGING_DIR} \
        ${BACKEND_STAGING_DIR}/server \
        ${BACKEND_STAGING_DIR}/src/integrations \
        ${CONFIG_STAGING_DIR}
"

if command -v rsync &> /dev/null; then
    rsync -avz --delete \
        -e "$RSYNC_SSH" \
        dist/ "${EC2_HOST}:${STAGING_DIR}/"
    rsync -avz --delete \
        -e "$RSYNC_SSH" \
        server/ "${EC2_HOST}:${BACKEND_STAGING_DIR}/server/"
else
    scp "${SSH_OPTS[@]}" -r dist/* "${EC2_HOST}:${STAGING_DIR}/"
    scp "${SSH_OPTS[@]}" -r server/* "${EC2_HOST}:${BACKEND_STAGING_DIR}/server/"
fi

scp "${SSH_OPTS[@]}" \
    package.json package-lock.json src/integrations/types.ts \
    "${EC2_HOST}:${BACKEND_STAGING_DIR}/"
scp "${SSH_OPTS[@]}" \
    deploy/nginx.conf deploy/smart-factory-server.service \
    "${EC2_HOST}:${CONFIG_STAGING_DIR}/"

echo "==> Step 3: Installing frontend and integration API..."
ssh "${SSH_OPTS[@]}" "$EC2_HOST" "
    sudo mkdir -p ${REMOTE_DIR}
    sudo rsync -a --delete ${STAGING_DIR}/ ${REMOTE_DIR}/ 2>/dev/null || \
        (sudo rm -rf ${REMOTE_DIR}/* && sudo cp -r ${STAGING_DIR}/* ${REMOTE_DIR}/)
    rm -rf ${STAGING_DIR}
    sudo chown -R nginx:nginx ${REMOTE_DIR}

    sudo mkdir -p ${REMOTE_APP_DIR}/server ${REMOTE_APP_DIR}/src/integrations
    sudo cp -r ${BACKEND_STAGING_DIR}/server/. ${REMOTE_APP_DIR}/server/
    sudo cp ${BACKEND_STAGING_DIR}/package.json ${REMOTE_APP_DIR}/package.json
    sudo cp ${BACKEND_STAGING_DIR}/package-lock.json ${REMOTE_APP_DIR}/package-lock.json
    sudo cp ${BACKEND_STAGING_DIR}/types.ts ${REMOTE_APP_DIR}/src/integrations/types.ts
    sudo chown -R ec2-user:ec2-user ${REMOTE_APP_DIR}
    cd ${REMOTE_APP_DIR}
    npm ci --omit=dev --no-audit --no-fund

    sudo install -m 0644 ${CONFIG_STAGING_DIR}/smart-factory-server.service /etc/systemd/system/smart-factory-server.service
    sudo install -m 0644 ${CONFIG_STAGING_DIR}/nginx.conf /etc/nginx/conf.d/smart-factory.conf
    rm -rf ${BACKEND_STAGING_DIR} ${CONFIG_STAGING_DIR}
"

echo "==> Step 4: Starting API and reloading Nginx..."
ssh "${SSH_OPTS[@]}" "$EC2_HOST" "
    sudo systemctl daemon-reload
    sudo systemctl enable smart-factory-server.service
    sudo systemctl restart smart-factory-server.service
    curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 1 \
        http://127.0.0.1:3001/api/health >/dev/null
    sudo nginx -t
    sudo systemctl reload nginx
"

# Extract hostname for the final URL
HOST_PART=$(echo "$EC2_HOST" | cut -d@ -f2)
echo "==> Done! Site is live at http://${HOST_PART}"
