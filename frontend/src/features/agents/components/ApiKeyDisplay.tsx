import { useState } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

interface ApiKeyDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  agentName: string;
}

/**
 * Modal component for displaying one-time API key
 * Shows the API key after agent creation or regeneration
 */
export const ApiKeyDisplay = ({ isOpen, onClose, apiKey, agentName }: ApiKeyDisplayProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="API Key Generated"
      size="md"
      footer={
        <Button onClick={onClose} variant="outline">
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Warning Message */}
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Save this API key now!
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              This is the only time you will see this key. Store it securely.
            </p>
          </div>
        </div>

        {/* Agent Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Agent Name
          </label>
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-gray-900 dark:text-gray-100 font-medium">{agentName}</p>
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key
          </label>
          <div className="relative">
            <div className="px-4 py-3 pr-24 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
              {apiKey}
            </div>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Installation Instructions Reference */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Next Steps
          </label>
          <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Return to the <strong>Agents</strong> page for detailed installation instructions including package download, server setup, and verification steps.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
