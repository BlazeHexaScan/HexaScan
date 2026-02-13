import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCircle,
  Building2,
  Shield,
  CreditCard,
  Users,
  Save,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useUpdateProfile, useChangePassword } from '@/features/auth/hooks/useProfile';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  ORG_ADMIN: { label: 'Admin', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  MEMBER: { label: 'Member', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  VIEWER: { label: 'Viewer', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  FREE: { label: 'Free', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  CLOUD: { label: 'Cloud', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  SELF_HOSTED: { label: 'Self-Hosted', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  ENTERPRISE: { label: 'Enterprise', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

export const ProfilePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  // Name edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.name || '');
  const { updateProfile, isUpdating, error: profileError, isSuccess: profileSuccess, reset: resetProfile } = useUpdateProfile();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
  const { changePassword, isChanging, error: passwordError, isSuccess: passwordSuccess, reset: resetPassword } = useChangePassword();

  if (!user) return null;

  const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.MEMBER;
  const planInfo = PLAN_LABELS[user.plan || 'FREE'] || PLAN_LABELS.FREE;
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSaveName = async () => {
    if (nameValue.trim().length < 2) return;
    resetProfile();
    try {
      await updateProfile({ name: nameValue.trim() });
      setIsEditingName(false);
    } catch {
      // error handled by hook
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFormError(null);
    resetPassword();

    if (newPassword !== confirmPassword) {
      setPasswordFormError('New passwords do not match');
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      // error handled by hook
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account settings</p>
      </div>

      {/* Account Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-300 text-xl font-bold">
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{user.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <UserCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
            </div>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') {
                      setIsEditingName(false);
                      setNameValue(user.name);
                    }
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={isUpdating || nameValue.trim().length < 2}
                  className="p-1.5 text-brand-600 hover:text-brand-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsEditingName(false);
                    setNameValue(user.name);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</span>
                <button
                  onClick={() => {
                    setNameValue(user.name);
                    setIsEditingName(true);
                    resetProfile();
                  }}
                  className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          {profileError && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {profileError}
            </p>
          )}
          {profileSuccess && !isEditingName && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Name updated successfully
            </p>
          )}

          {/* Email */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <UserCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{user.email}</span>
          </div>

          {/* Organization */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Organization</span>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.organizationName}</span>
          </div>

          {/* Role */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Role</span>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
          </div>

          {/* Plan */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Plan</span>
            </div>
            <Link
              to="/plans"
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${planInfo.color} hover:opacity-80 transition-opacity`}
            >
              {planInfo.label}
            </Link>
          </div>

          {/* Team */}
          {user.teamId && (
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Team</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.teamId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Current Password */}
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Password requirements */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Password must be at least 8 characters with one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).
          </p>

          {/* Error/Success messages */}
          {(passwordFormError || passwordError) && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {passwordFormError || passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Password changed successfully
            </p>
          )}

          <button
            type="submit"
            disabled={isChanging || !currentPassword || !newPassword || !confirmPassword}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isChanging ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
