import { useState } from 'react';
import { Plus, Server, Terminal, ChevronDown, ChevronUp, HelpCircle, X } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useAgents, useRegenerateApiKey } from '@/features/agents/hooks/useAgents';
import { Agent } from '@/types';
import { AgentCard } from '@/features/agents/components/AgentCard';
import { AgentFormModal } from '@/features/agents/components/AgentFormModal';
import { ApiKeyDisplay } from '@/features/agents/components/ApiKeyDisplay';
import { getErrorMessage } from '@/lib/api/client';

/**
 * Agents list page with card view
 */
export const AgentsPage = () => {
  const { data: agents, isLoading, error } = useAgents();
  const regenerateApiKey = useRegenerateApiKey();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | undefined>(undefined);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [regeneratedApiKey, setRegeneratedApiKey] = useState('');
  const [regeneratedAgentName, setRegeneratedAgentName] = useState('');
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [showInstallSteps, setShowInstallSteps] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Get API URL from environment variable
  const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
  // Extract base URL (remove /api/v1 suffix if present)
  const baseApiUrl = apiUrl.replace(/\/api\/v1$/, '');

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingAgent(undefined);
  };

  const handleRegenerateKey = async (agent: Agent) => {
    if (!confirm(`Are you sure you want to regenerate the API key for "${agent.name}"? The old key will be immediately invalidated.`)) {
      return;
    }

    try {
      setRegenerateError(null);
      const response = await regenerateApiKey.mutateAsync(agent.id);
      setRegeneratedApiKey(response.apiKey);
      setRegeneratedAgentName(response.name);
      setShowApiKeyModal(true);
    } catch (err) {
      setRegenerateError(getErrorMessage(err));
    }
  };

  const handleCloseApiKeyModal = () => {
    setShowApiKeyModal(false);
    setRegeneratedApiKey('');
    setRegeneratedAgentName('');
    setRegenerateError(null);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agents</h1>
        </div>
        <Card>
          <div className="p-6 text-center">
            <p className="text-red-600 dark:text-red-400">
              Failed to load agents. Please try again.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const hasAgents = agents && agents.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agents</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage monitoring agents for internal monitors
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Agent
        </Button>
      </div>

      {/* Regenerate Error */}
      {regenerateError && (
        <Card>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{regenerateError}</p>
          </div>
        </Card>
      )}

      {/* Installation Instructions */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-brand-100 dark:bg-brand-900 rounded-lg">
            <Terminal className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Installing an Agent
              </h3>
              <button
                onClick={() => setShowInstallSteps(!showInstallSteps)}
                className="flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
              >
                {showInstallSteps ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide Steps
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show Steps
                  </>
                )}
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              After creating an agent, you will receive an API key. Follow these steps to install the agent:
            </p>

            {showInstallSteps && (
            <div className="space-y-4">
              {/* Step 1: Download Package */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Download the agent package:</p>
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <a
                    href={`${baseApiUrl}/downloads/hexascan-agent.tar.gz`}
                    download
                    className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download hexascan-agent.tar.gz
                  </a>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Or use wget/curl on your server directly
                  </p>
                </div>
              </div>

              {/* Step 2: Upload to Server */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Download directly to your server (or upload via scp):</p>
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm overflow-x-auto">
                  <code className="text-gray-900 dark:text-gray-100 whitespace-pre">
{`# Option A: Download directly to server
wget ${baseApiUrl}/downloads/hexascan-agent.tar.gz -O /tmp/hexascan-agent.tar.gz

# Option B: Upload from local machine
scp hexascan-agent.tar.gz user@your-server:/tmp/`}
                  </code>
                </div>
              </div>

              {/* Step 3: Install on Server */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">3. SSH to your server and run the installer:</p>
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm overflow-x-auto">
                  <code className="text-gray-900 dark:text-gray-100 whitespace-pre">
{`ssh user@your-server
cd /tmp
tar -xzf hexascan-agent.tar.gz
sed -i 's/\\r$//' /tmp/scripts/install.sh
sudo bash /tmp/scripts/install.sh \\
  --api-key "YOUR_API_KEY" \\
  --endpoint "${baseApiUrl}/api/v1" \\
  --name "your-agent-name"`}
                  </code>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  The agent will be installed to <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/opt/hexascan-agent/</code> and run as a systemd service.
                </p>
              </div>

              {/* Step 4: Verify Installation */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">4. Verify the agent is running:</p>
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm overflow-x-auto">
                  <code className="text-gray-900 dark:text-gray-100 whitespace-pre">
{`sudo systemctl status hexascan-agent
sudo journalctl -u hexascan-agent -f`}
                  </code>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Press Ctrl+C to stop watching logs</p>
              </div>

              {/* Step 5: Check Dashboard */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">5. Verify in dashboard:</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your agent should show status <span className="font-semibold text-green-600 dark:text-green-400">ONLINE</span> in the cards above within 1-2 minutes.
                </p>
              </div>

              {/* Updating Instructions */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Updating an existing agent:</p>
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm overflow-x-auto">
                  <code className="text-gray-900 dark:text-gray-100 whitespace-pre">
{`# On your local machine, create new package
cd /path/to/HexaScan/agent
tar -czf hexascan-agent.tar.gz hexascan_agent requirements.txt scripts
scp hexascan-agent.tar.gz user@your-server:/tmp/

# On the server
ssh user@your-server
sudo systemctl stop hexascan-agent
cd /tmp && tar -xzf hexascan-agent.tar.gz
sudo rm -rf /opt/hexascan-agent/hexascan_agent
sudo cp -r hexascan_agent /opt/hexascan-agent/
sudo chown -R hexascan-agent:hexascan-agent /opt/hexascan-agent/hexascan_agent
sudo systemctl start hexascan-agent
sudo journalctl -u hexascan-agent -f`}
                  </code>
                </div>
              </div>

              {/* Having Issues Link */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowTroubleshooting(true)}
                  className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                >
                  <HelpCircle className="w-4 h-4" />
                  Having issues? Click here for troubleshooting tips
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      </Card>

      {/* Agents Grid or Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </Card>
          ))}
        </div>
      ) : hasAgents ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={handleEdit}
              onRegenerateKey={handleRegenerateKey}
            />
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <Server className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No agents yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Agents allow you to monitor internal metrics like disk usage, memory, CPU, and more.
              Add your first agent to get started.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Agent
            </Button>
          </div>
        </Card>
      )}

      {/* Agent Form Modal */}
      <AgentFormModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        agent={editingAgent}
      />

      {/* API Key Display Modal (for regeneration) */}
      {showApiKeyModal && (
        <ApiKeyDisplay
          isOpen={showApiKeyModal}
          onClose={handleCloseApiKeyModal}
          apiKey={regeneratedApiKey}
          agentName={regeneratedAgentName}
        />
      )}

      {/* Troubleshooting Modal */}
      {showTroubleshooting && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowTroubleshooting(false)}
            />

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-amber-500" />
                  Troubleshooting Guide
                </h3>
                <button
                  onClick={() => setShowTroubleshooting(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-6">
                {/* Quick Checklist */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">Quick Diagnostic Checklist</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">Check</th>
                          <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Command</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-xs">
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">Agent code exists</td>
                          <td className="py-2"><code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">ls /opt/hexascan-agent/hexascan_agent/</code></td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">Log dir permissions</td>
                          <td className="py-2"><code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">ls -la /var/log/hexascan-agent/</code></td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">Config permissions</td>
                          <td className="py-2"><code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">ls -la /etc/hexascan-agent/</code></td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">SELinux status (RHEL/CentOS)</td>
                          <td className="py-2"><code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">getenforce</code></td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">Service status</td>
                          <td className="py-2"><code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">sudo systemctl status hexascan-agent</code></td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">Service logs</td>
                          <td className="py-2"><code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">sudo journalctl -u hexascan-agent -f</code></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Issue 1: SELinux */}
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Issue: Exit code 226/NAMESPACE (CentOS/RHEL)</h4>
                  <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                    SELinux is blocking the service from running.
                  </p>
                  <div className="bg-white dark:bg-gray-900 rounded px-3 py-2 font-mono text-xs overflow-x-auto">
                    <code className="text-gray-900 dark:text-gray-100">{`# Check SELinux status
getenforce

# If "Enforcing", temporarily disable to test
sudo setenforce 0

# Restart agent
sudo systemctl restart hexascan-agent`}</code>
                  </div>
                </div>

                {/* Issue 2: Module not found */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Issue: ModuleNotFoundError - No module named 'hexascan_agent'</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                    Agent code wasn't copied to the correct location during installation.
                  </p>
                  <div className="bg-white dark:bg-gray-900 rounded px-3 py-2 font-mono text-xs overflow-x-auto">
                    <code className="text-gray-900 dark:text-gray-100">{`# Copy agent code to proper location
sudo cp -r /tmp/hexascan_agent /opt/hexascan-agent/
sudo chown -R hexascan-agent:hexascan-agent /opt/hexascan-agent/hexascan_agent

# Restart agent
sudo systemctl restart hexascan-agent`}</code>
                  </div>
                </div>

                {/* Issue 3: Permission denied */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Issue: Permission denied on log or config files</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                    The hexascan-agent user doesn't have permission to access required files.
                  </p>
                  <div className="bg-white dark:bg-gray-900 rounded px-3 py-2 font-mono text-xs overflow-x-auto">
                    <code className="text-gray-900 dark:text-gray-100">{`# Fix log directory permissions
sudo chown -R hexascan-agent:hexascan-agent /var/log/hexascan-agent
sudo chmod 755 /var/log/hexascan-agent

# Fix config permissions
sudo chown hexascan-agent:hexascan-agent /etc/hexascan-agent/api_key
sudo chmod 644 /etc/hexascan-agent/api_key

# Restart agent
sudo systemctl restart hexascan-agent`}</code>
                  </div>
                </div>

                {/* Issue 4: Conda/Custom Python */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Issue: Using Conda or custom Python environment</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                    If your server uses Conda or a custom Python installation, you may need to update the service file.
                  </p>
                  <div className="bg-white dark:bg-gray-900 rounded px-3 py-2 font-mono text-xs overflow-x-auto">
                    <code className="text-gray-900 dark:text-gray-100">{`# Edit service file
sudo nano /etc/systemd/system/hexascan-agent.service

# Update ExecStart to use your Python path:
ExecStart=/path/to/your/python -m hexascan_agent.agent -c /etc/hexascan-agent/agent.yaml

# For conda, you might also need:
User=root
Group=root

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart hexascan-agent`}</code>
                  </div>
                </div>

                {/* Manual Test */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Tip: Test manually before using systemd</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Run the agent manually to see detailed error messages:
                  </p>
                  <div className="bg-white dark:bg-gray-900 rounded px-3 py-2 font-mono text-xs overflow-x-auto">
                    <code className="text-gray-900 dark:text-gray-100">{`# Run manually with sudo
cd /opt/hexascan-agent
sudo /opt/hexascan-agent/venv/bin/python -m hexascan_agent.agent -c /etc/hexascan-agent/agent.yaml`}</code>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <button
                  onClick={() => setShowTroubleshooting(false)}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
