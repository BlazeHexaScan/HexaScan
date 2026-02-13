import { useState, useEffect } from 'react';
import { useAdminConfig, useUpdateAdminConfig, useResetAdminConfig } from '@/features/admin';
import { AdminConfigItem } from '@/types/admin';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';

/**
 * Config keys ending in "Ms" store milliseconds in the DB.
 * We display them as seconds in the UI for readability.
 */
const isMsKey = (key: string) => key.endsWith('Ms');
const msToSeconds = (ms: number) => ms / 1000;
const secondsToMs = (s: number) => s * 1000;

const formatLabel = (label: string, key: string) => {
  if (isMsKey(key)) return label.replace(/\(ms\)/i, '(seconds)').replace(/\(milliseconds\)/i, '(seconds)');
  return label;
};

const formatDescription = (desc: string | null, key: string) => {
  if (!desc) return desc;
  if (isMsKey(key)) return desc.replace(/milliseconds/gi, 'seconds');
  return desc;
};

const CATEGORY_LABELS: Record<string, string> = {
  escalation: 'Escalation',
  alerts: 'Alerts',
  healthScore: 'Health Score',
  webMonitoring: 'Web Monitoring',
  checkExecution: 'Check Execution',
  repoScanner: 'Repo Scanner',
  agent: 'Agent',
  auth: 'Authentication',
  pageSpeed: 'PageSpeed & Playwright',
};

export const AdminConfigPage = () => {
  const { data: config, isLoading } = useAdminConfig();
  const updateConfig = useUpdateAdminConfig();
  const resetConfig = useResetAdminConfig();

  const [activeCategory, setActiveCategory] = useState<string>('');
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const categories = config ? Object.keys(config.categories) : [];

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const currentItems: AdminConfigItem[] = config?.categories[activeCategory] || [];

  const hasChanges = Object.keys(editedValues).length > 0;

  const handleValueChange = (key: string, value: any, item: AdminConfigItem) => {
    let parsedValue = value;
    if (item.valueType === 'number') {
      parsedValue = value === '' ? '' : Number(value);
    } else if (item.valueType === 'boolean') {
      parsedValue = value === 'true' || value === true;
    } else if (item.valueType === 'json') {
      parsedValue = value; // Keep as string for editing, parse on save
    }

    // Check if value is same as current (compare in display units)
    const currentValue = isMsKey(item.key) && item.valueType === 'number' && typeof item.value === 'number'
      ? msToSeconds(item.value)
      : item.value;
    if (JSON.stringify(parsedValue) === JSON.stringify(currentValue)) {
      const newEdited = { ...editedValues };
      delete newEdited[key];
      setEditedValues(newEdited);
    } else {
      setEditedValues({ ...editedValues, [key]: parsedValue });
    }
  };

  const handleSave = async () => {
    try {
      const updates = Object.entries(editedValues).map(([key, value]) => {
        const item = currentItems.find(i => i.key === key);
        // Parse JSON strings
        if (item?.valueType === 'json' && typeof value === 'string') {
          return { key, value: JSON.parse(value) };
        }
        // Convert seconds back to ms for storage
        if (isMsKey(key) && item?.valueType === 'number' && typeof value === 'number') {
          return { key, value: secondsToMs(value) };
        }
        return { key, value };
      });

      await updateConfig.mutateAsync({ updates });
      setEditedValues({});
      setSaveMessage('Configuration saved. Restart the server for changes to take effect.');
      setTimeout(() => setSaveMessage(null), 8000);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save configuration');
    }
  };

  const handleReset = async (key: string) => {
    if (!confirm('Reset this value to its default?')) return;
    try {
      await resetConfig.mutateAsync(key);
      const newEdited = { ...editedValues };
      delete newEdited[key];
      setEditedValues(newEdited);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to reset configuration');
    }
  };

  const getDisplayValue = (item: AdminConfigItem) => {
    if (editedValues[item.key] !== undefined) return editedValues[item.key];
    // Convert ms → seconds for display
    if (isMsKey(item.key) && item.valueType === 'number' && typeof item.value === 'number') {
      return msToSeconds(item.value);
    }
    return item.value;
  };

  const renderInput = (item: AdminConfigItem) => {
    const value = getDisplayValue(item);
    const isEdited = editedValues[item.key] !== undefined;

    const baseClass = `w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm ${
      isEdited ? 'border-violet-400 ring-1 ring-violet-400' : 'border-gray-300 dark:border-gray-600'
    }`;

    switch (item.valueType) {
      case 'boolean':
        return (
          <select
            value={String(value)}
            onChange={(e) => handleValueChange(item.key, e.target.value, item)}
            className={baseClass}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        );
      case 'json':
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => handleValueChange(item.key, e.target.value, item)}
            className={`${baseClass} font-mono text-xs`}
            rows={3}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleValueChange(item.key, e.target.value, item)}
            className={baseClass}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(item.key, e.target.value, item)}
            className={baseClass}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Configuration</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Edit global system settings. Changes require a server restart.
          </p>
        </div>
        {hasChanges && (
          <button onClick={handleSave} disabled={updateConfig.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium">
            <Save className="w-4 h-4" />
            {updateConfig.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Restart warning */}
      <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p>Changes to system configuration require a server restart to take effect.</p>
        </div>
      </div>

      {saveMessage && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-sm text-green-800 dark:text-green-200">{saveMessage}</p>
        </div>
      )}

      <div className="flex gap-6">
        {/* Category tabs - vertical */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                  activeCategory === cat
                    ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Config items */}
        <div className="flex-1 space-y-4">
          {currentItems.map((item) => (
            <div key={item.key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatLabel(item.label, item.key)}</label>
                    {item.isModified && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded">modified</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{formatDescription(item.description, item.key)}</p>
                  )}
                  <div className="max-w-md">
                    {renderInput(item)}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Default: {isMsKey(item.key) && item.valueType === 'number' && typeof item.defaultValue === 'number'
                      ? `${msToSeconds(item.defaultValue)} seconds`
                      : JSON.stringify(item.defaultValue)}
                  </p>
                </div>
                {item.isModified && (
                  <button onClick={() => handleReset(item.key)} title="Reset to default"
                    className="p-2 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
