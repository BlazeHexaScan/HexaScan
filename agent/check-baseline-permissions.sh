#!/bin/bash
# Diagnostic script to check baseline directory permissions

echo "=== Filesystem Integrity Check - Permission Diagnostics ==="
echo ""

BASELINE_DIR="/tmp/hexascan_agent/baselines"
TEST_FILE="$BASELINE_DIR/test_write.json"

echo "1. Checking if baseline directory exists..."
if [ -d "$BASELINE_DIR" ]; then
    echo "   ✓ Directory exists: $BASELINE_DIR"
    ls -ld "$BASELINE_DIR"
else
    echo "   ✗ Directory does NOT exist: $BASELINE_DIR"
fi

echo ""
echo "2. Checking /tmp permissions..."
ls -ld /tmp

echo ""
echo "3. Checking /tmp/hexascan_agent permissions..."
if [ -d "/tmp/hexascan_agent" ]; then
    ls -ld /tmp/hexascan_agent
else
    echo "   Directory does not exist"
fi

echo ""
echo "4. Checking hexascan-agent service user..."
AGENT_USER=$(ps aux | grep hexascan-agent | grep -v grep | awk '{print $1}' | head -1)
if [ -n "$AGENT_USER" ]; then
    echo "   Agent running as: $AGENT_USER"
    id "$AGENT_USER"
else
    echo "   Agent process not found"
fi

echo ""
echo "5. Attempting to create test directory as root..."
sudo mkdir -p "$BASELINE_DIR"
sudo ls -ld "$BASELINE_DIR"

echo ""
echo "6. Setting permissions for hexascan-agent user..."
if [ -n "$AGENT_USER" ]; then
    sudo chown -R "$AGENT_USER:$AGENT_USER" /tmp/hexascan_agent
    sudo chmod -R 755 /tmp/hexascan_agent
    echo "   ✓ Set ownership to $AGENT_USER"
    ls -ld /tmp/hexascan_agent
    ls -ld "$BASELINE_DIR"
else
    echo "   ✗ Cannot set permissions - agent user unknown"
fi

echo ""
echo "7. Testing write as hexascan-agent user..."
if [ -n "$AGENT_USER" ]; then
    sudo -u "$AGENT_USER" touch "$TEST_FILE"
    if [ -f "$TEST_FILE" ]; then
        echo "   ✓ Write test successful"
        ls -l "$TEST_FILE"
        sudo rm "$TEST_FILE"
    else
        echo "   ✗ Write test FAILED"
    fi
else
    echo "   ✗ Cannot test - agent user unknown"
fi

echo ""
echo "8. Listing existing baseline files..."
if [ -d "$BASELINE_DIR" ]; then
    ls -lah "$BASELINE_DIR"
else
    echo "   No baseline directory found"
fi

echo ""
echo "=== Diagnostic Complete ==="
echo ""
echo "Next steps:"
echo "1. If directory doesn't exist, the script created it above"
echo "2. Restart the agent: sudo systemctl restart hexascan-agent"
echo "3. Trigger the check from dashboard"
echo "4. Check logs: sudo journalctl -u hexascan-agent -f"
