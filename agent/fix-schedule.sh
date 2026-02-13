#!/bin/bash
# Script to fix the Filesystem Integrity check schedule

echo "=== Fixing Filesystem Integrity Check Schedule ==="
echo ""

echo "1. Current schedule configuration:"
sudo -u postgres psql hexascan -c "SELECT id, name, type, schedule, enabled FROM \"Check\" WHERE type = 'FILESYSTEM_INTEGRITY';"
echo ""

echo "2. Updating schedule to run daily at midnight (0 0 * * *):"
sudo -u postgres psql hexascan -c "UPDATE \"Check\" SET schedule = '0 0 * * *' WHERE type = 'FILESYSTEM_INTEGRITY';"
echo ""

echo "3. Verify the update:"
sudo -u postgres psql hexascan -c "SELECT id, name, type, schedule, enabled, \"updatedAt\" FROM \"Check\" WHERE type = 'FILESYSTEM_INTEGRITY';"
echo ""

echo "4. Restart backend to apply changes:"
cd /var/www/html/hexascan/backend
pm2 restart hexascan-backend
echo ""

echo "5. Check backend logs for schedule reload:"
pm2 logs hexascan-backend --lines 20 --nostream | grep -i "schedule\|filesystem"
echo ""

echo "=== Schedule Fix Complete ==="
echo ""
echo "The Filesystem Integrity check should now run daily at midnight (00:00)"
echo "Next run time will be shown in the dashboard"
