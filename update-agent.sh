#!/bin/bash
#
# Quick update script for hexascan-agent on remote server
# Usage: ./update-agent.sh user@host
#

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 user@host"
    echo "Example: $0 sysadmin@hexascan.com"
    exit 1
fi

SERVER="$1"

echo "=== HexaScan Agent Update Script ==="
echo "Target server: $SERVER"
echo ""

# Package the agent code
echo "[1/4] Packaging agent code..."
cd agent
tar -czf /tmp/hexascan-agent-update.tar.gz hexascan_agent/
cd ..

# Upload to server
echo "[2/4] Uploading to server..."
scp /tmp/hexascan-agent-update.tar.gz "$SERVER:/tmp/"

# Extract and restart on server
echo "[3/4] Updating agent on server..."
ssh "$SERVER" << 'ENDSSH'
set -e

# Stop agent
echo "Stopping agent service..."
sudo systemctl stop hexascan-agent || true

# Backup current installation
if [ -d /opt/hexascan-agent/hexascan_agent ]; then
    echo "Backing up current installation..."
    sudo mv /opt/hexascan-agent/hexascan_agent /opt/hexascan-agent/hexascan_agent.backup.$(date +%Y%m%d_%H%M%S)
fi

# Extract new version
echo "Extracting new version..."
cd /tmp
tar -xzf hexascan-agent-update.tar.gz
sudo mv hexascan_agent /opt/hexascan-agent/

# Set ownership
sudo chown -R hexascan-agent:hexascan-agent /opt/hexascan-agent/hexascan_agent

# Start agent
echo "Starting agent service..."
sudo systemctl start hexascan-agent

# Check status
sleep 2
sudo systemctl status hexascan-agent --no-pager -l

echo ""
echo "Update complete!"
ENDSSH

# Cleanup
echo "[4/4] Cleaning up..."
rm /tmp/hexascan-agent-update.tar.gz

echo ""
echo "=== Update Complete ==="
echo ""
echo "To view logs, run:"
echo "  ssh $SERVER 'sudo journalctl -u hexascan-agent -f'"
echo ""
echo "Or check the log file:"
echo "  ssh $SERVER 'sudo tail -f /var/log/hexascan-agent/agent.log'"
