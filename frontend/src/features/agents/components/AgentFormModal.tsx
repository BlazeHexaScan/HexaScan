import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { useCreateAgent, useUpdateAgent } from '../hooks/useAgents';
import { Agent, CreateAgentRequest, UpdateAgentRequest } from '@/types';
import { getErrorMessage } from '@/lib/api/client';
import { ApiKeyDisplay } from './ApiKeyDisplay';

interface AgentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: Agent;
  onSuccess?: () => void;
}

/**
 * Modal form for creating or editing an agent
 */
export const AgentFormModal = ({ isOpen, onClose, agent, onSuccess }: AgentFormModalProps) => {
  const isEdit = !!agent;
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();

  const [formData, setFormData] = useState({
    name: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState('');
  const [agentName, setAgentName] = useState('');

  // Initialize form data when editing
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
      });
    } else {
      setFormData({
        name: '',
      });
    }
    setErrors({});
  }, [agent, isOpen]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Agent name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (isEdit && agent) {
        const updateData: UpdateAgentRequest = {
          name: formData.name,
        };

        await updateAgent.mutateAsync({ agentId: agent.id, data: updateData });
        onSuccess?.();
        onClose();
      } else {
        const createData: CreateAgentRequest = {
          name: formData.name,
        };

        const response = await createAgent.mutateAsync(createData);

        // Show the API key modal
        // Backend returns agent fields at root level with apiKey
        setGeneratedApiKey(response.apiKey);
        setAgentName(response.name);
        setShowApiKey(true);

        onSuccess?.();
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setErrors({ submit: errorMessage });
    }
  };

  const handleCloseApiKeyModal = () => {
    setShowApiKey(false);
    setGeneratedApiKey('');
    setAgentName('');
    onClose();
  };

  const isSubmitting = createAgent.isPending || updateAgent.isPending;

  return (
    <>
      <Modal
        isOpen={isOpen && !showApiKey}
        onClose={onClose}
        title={isEdit ? 'Edit Agent' : 'Add New Agent'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={isSubmitting}>
              {isEdit ? 'Update Agent' : 'Create Agent'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Agent Name"
            required
            fullWidth
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
            placeholder="Production Server 01"
            helperText="A descriptive name for this monitoring agent"
            disabled={isSubmitting}
          />

          {!isEdit && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                After creating the agent, you will receive an API key. This key will only be shown once,
                so make sure to save it securely.
              </p>
            </div>
          )}

          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}
        </form>
      </Modal>

      {/* API Key Display Modal */}
      {showApiKey && (
        <ApiKeyDisplay
          isOpen={showApiKey}
          onClose={handleCloseApiKeyModal}
          apiKey={generatedApiKey}
          agentName={agentName}
        />
      )}
    </>
  );
};
