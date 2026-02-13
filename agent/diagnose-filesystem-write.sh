#!/bin/bash
# Diagnostic script for filesystem write issues

echo "=== Filesystem Write Diagnostics ==="
echo ""

echo "1. Check SELinux status:"
if command -v sestatus &> /dev/null; then
    sestatus
else
    echo "   SELinux not installed"
fi
echo ""

echo "2. Check AppArmor status:"
if command -v aa-status &> /dev/null; then
    sudo aa-status 2>/dev/null | grep hexascan || echo "   No hexascan-agent AppArmor profile found"
else
    echo "   AppArmor not installed"
fi
echo ""

echo "3. Check /tmp mount options:"
mount | grep -E "^[^ ]+ on /tmp"
echo ""

echo "4. Check disk space:"
df -h /tmp /home/sysadmin /opt
echo ""

echo "5. Check hexascan-agent service user:"
id hexascan-agent 2>/dev/null || echo "   hexascan-agent user not found"
echo ""

echo "6. Check systemd service restrictions:"
if systemctl show hexascan-agent.service &>/dev/null; then
    echo "   ReadWritePaths:"
    systemctl show hexascan-agent.service -p ReadWritePaths
    echo "   ReadOnlyPaths:"
    systemctl show hexascan-agent.service -p ReadOnlyPaths
    echo "   ProtectSystem:"
    systemctl show hexascan-agent.service -p ProtectSystem
    echo "   ProtectHome:"
    systemctl show hexascan-agent.service -p ProtectHome
else
    echo "   hexascan-agent service not found"
fi
echo ""

echo "7. Test Python file write as hexascan-agent user:"
sudo -u hexascan-agent python3 -c '
import os
import tempfile

test_dir = "/tmp/hexascan-agent-baselines"
os.makedirs(test_dir, exist_ok=True)

test_file = os.path.join(test_dir, "test_write.json")
try:
    with open(test_file, "w") as f:
        f.write("{\"test\": true}")
        f.flush()
    print(f"   SUCCESS: Wrote to {test_file}")
    os.remove(test_file)
except Exception as e:
    print(f"   FAILED: {e}")
'
echo ""

echo "8. Check audit logs for denials (last 50 lines):"
if [ -f /var/log/audit/audit.log ]; then
    sudo grep -i "denied" /var/log/audit/audit.log | grep hexascan | tail -n 50
else
    echo "   No audit log found"
fi
echo ""

echo "9. Check systemd journal for hexascan-agent errors:"
sudo journalctl -u hexascan-agent -n 20 --no-pager | grep -i "errno\|permission\|denied" || echo "   No permission-related errors in recent logs"
echo ""

echo "10. Check /tmp/hexascan-agent-baselines permissions:"
if [ -d /tmp/hexascan-agent-baselines ]; then
    ls -ld /tmp/hexascan-agent-baselines
    echo "   Files in directory:"
    ls -lah /tmp/hexascan-agent-baselines 2>/dev/null || echo "   Directory is empty"
else
    echo "   Directory does not exist - creating it now..."
    sudo mkdir -p /tmp/hexascan-agent-baselines
    sudo chown hexascan-agent:hexascan-agent /tmp/hexascan-agent-baselines
    sudo chmod 755 /tmp/hexascan-agent-baselines
    ls -ld /tmp/hexascan-agent-baselines
fi
echo ""

echo "=== Diagnostics Complete ==="
echo ""
echo "NEXT STEPS:"
echo "1. If SELinux is enforcing, check for denials in audit log"
echo "2. If systemd has ProtectSystem=strict or ProtectHome=yes, files may be blocked"
echo "3. If /tmp is mounted read-only or noexec, that could cause issues"
echo "4. If Python test fails but bash touch works, it's likely SELinux/AppArmor"
