/**
 * Add Repository Modal
 * Modal for adding a new repository for scanning
 * Supports both public and private repositories with platform-specific PAT instructions
 */

import { useState } from 'react';
import { X, GitBranch, Globe, Lock, Eye, EyeOff, Info } from 'lucide-react';
import { Button } from '@/components/ui';
import { useCreateRepository } from '../hooks/useRepoScanner';
import type { RepositoryPlatform } from '@/types/repo-scanner';

interface AddRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (repositoryId: string) => void;
}

const PLATFORM_LABELS: Record<RepositoryPlatform, string> = {
  GITHUB: 'GitHub',
  GITLAB: 'GitLab',
  BITBUCKET: 'Bitbucket',
  AZURE_DEVOPS: 'Azure DevOps',
  OTHER: 'Other',
};

function detectPlatform(url: string): RepositoryPlatform {
  if (url.includes('github.com')) return 'GITHUB';
  if (url.includes('gitlab.com')) return 'GITLAB';
  if (url.includes('bitbucket.org')) return 'BITBUCKET';
  if (url.includes('dev.azure.com') || url.includes('visualstudio.com')) return 'AZURE_DEVOPS';
  return 'OTHER';
}

type PlatformInstructionsData = { steps: string[]; link: string; linkLabel: string };

const PLATFORM_INSTRUCTIONS: Record<RepositoryPlatform, PlatformInstructionsData> = {
  GITHUB: {
    steps: [
      'Go to GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens',
      'Click "Generate new token"',
      'Give it a name and set an expiration date',
      'Under "Repository access", select the specific repository or "All repositories"',
      'Under "Permissions > Repository permissions", set "Contents" to "Read-only"',
      'Click "Generate token" and copy the token',
    ],
    link: 'https://github.com/settings/personal-access-tokens/new',
    linkLabel: 'Create GitHub Token',
  },
  GITLAB: {
    steps: [
      'Go to GitLab > User Settings > Access Tokens',
      'Click "Add new token"',
      'Give it a name and set an expiration date',
      'Select the "read_repository" scope',
      'Click "Create personal access token" and copy the token',
    ],
    link: 'https://gitlab.com/-/user_settings/personal_access_tokens',
    linkLabel: 'Create GitLab Token',
  },
  BITBUCKET: {
    steps: [
      'Go to Bitbucket > Personal settings > App passwords',
      'Click "Create app password"',
      'Give it a label',
      'Under "Permissions", check "Repositories > Read"',
      'Click "Create" and copy the app password',
    ],
    link: 'https://bitbucket.org/account/settings/app-passwords/',
    linkLabel: 'Create Bitbucket App Password',
  },
  AZURE_DEVOPS: {
    steps: [
      'Go to Azure DevOps > User settings (top-right) > Personal access tokens',
      'Click "New Token"',
      'Give it a name, set the organization, and expiration',
      'Under "Scopes", select "Custom defined" and check "Code > Read"',
      'Click "Create" and copy the token',
    ],
    link: 'https://dev.azure.com/_usersSettings/tokens',
    linkLabel: 'Create Azure DevOps Token',
  },
  OTHER: {
    steps: [
      'Generate a personal access token from your Git hosting provider',
      'The token should have read-only access to the repository',
      'Copy the token and paste it in the field above',
    ],
    link: '',
    linkLabel: '',
  },
};

function PlatformInstructions({ platform }: { platform: RepositoryPlatform }) {
  const info = PLATFORM_INSTRUCTIONS[platform];
  if (!info) return null;

  return (
    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-blue-800 dark:text-blue-300 mb-2">
            How to create a {PLATFORM_LABELS[platform]} access token:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400">
            {info.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {info.link && (
            <a
              href={info.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {info.linkLabel} &rarr;
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function AddRepoModal({ isOpen, onClose, onSuccess }: AddRepoModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    branch: 'main',
    isPrivate: false,
    accessToken: '',
  });
  const [showToken, setShowToken] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useCreateRepository();

  // Auto-detect platform from URL for showing instructions
  const detectedPlatform: RepositoryPlatform = formData.url ? detectPlatform(formData.url) : 'OTHER';

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Repository name is required';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'Repository URL is required';
    } else {
      const urlRegex = /^(https?:\/\/|git@)[\w.-]+(:\d+)?[/:][\w./-]+(\.git)?$/;
      if (!urlRegex.test(formData.url.trim())) {
        newErrors.url = 'Please enter a valid Git repository URL';
      }
    }

    if (formData.isPrivate) {
      if (!formData.accessToken.trim()) {
        newErrors.accessToken = 'Access token is required for private repositories';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const payload: any = {
        name: formData.name.trim(),
        url: formData.url.trim(),
        branch: formData.branch.trim() || 'main',
        isPrivate: formData.isPrivate,
      };

      if (formData.isPrivate) {
        payload.accessToken = formData.accessToken;
      }

      const result = await createMutation.mutateAsync(payload);

      // Reset form
      setFormData({ name: '', url: '', branch: 'main', isPrivate: false, accessToken: '' });
      setErrors({});
      setShowToken(false);

      if (onSuccess) {
        onSuccess(result.id);
      }

      onClose();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setErrors({ submit: error.response.data.error });
      } else {
        setErrors({ submit: 'Failed to add repository' });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add Repository
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Repository Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Project"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Repository URL
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://github.com/username/repo.git"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            {errors.url && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.url}</p>
            )}
          </div>

          {/* Branch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Branch
            </label>
            <div className="relative">
              <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                placeholder="main"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Repository Type - Public/Private Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Repository Type
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isPrivate: false, accessToken: '' })}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-colors ${
                  !formData.isPrivate
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="font-medium">Public</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isPrivate: true })}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-colors ${
                  formData.isPrivate
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span className="font-medium">Private</span>
              </button>
            </div>
          </div>

          {/* Private Repository Fields */}
          {formData.isPrivate && (
            <>
              {/* Access Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Access Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={formData.accessToken}
                    onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                    placeholder="Paste your personal access token"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                             focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.accessToken && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.accessToken}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Your token is encrypted before storage and never exposed in API responses.
                </p>
              </div>

              {/* Platform-specific PAT Instructions (auto-detected from URL) */}
              {formData.url && (
                <PlatformInstructions platform={detectedPlatform} />
              )}
            </>
          )}

          {/* Submit error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? (formData.isPrivate ? 'Validating Token & Adding...' : 'Adding...')
                : 'Add Repository'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
