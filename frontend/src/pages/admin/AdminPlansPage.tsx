import { useState } from 'react';
import { Edit2, X, Save, AlertTriangle, Globe, Activity, Server, Bell, Clock, Users, Zap, Check } from 'lucide-react';
import { useAdminPlans, useUpdateAdminPlan, useAdminOrganizations } from '@/features/admin';
import { PlanDefinition, PlanType, UpdatePlanDefinitionRequest } from '@/types/admin';

export const AdminPlansPage = () => {
  const { data: plans, isLoading, error } = useAdminPlans();
  const { data: organizationsData } = useAdminOrganizations();
  const updatePlanMutation = useUpdateAdminPlan();
  const [editingPlan, setEditingPlan] = useState<PlanDefinition | null>(null);
  const [formData, setFormData] = useState<UpdatePlanDefinitionRequest>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Count organizations per plan type
  const getOrgCountForPlan = (planType: PlanType): number => {
    if (!organizationsData?.organizations) return 0;
    return organizationsData.organizations.filter((org) => org.plan === planType).length;
  };

  const handleEdit = (plan: PlanDefinition) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      limits: { ...plan.limits },
    });
    setSuccessMessage(null);
  };

  const handleClose = () => {
    setEditingPlan(null);
    setFormData({});
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    try {
      const result = await updatePlanMutation.mutateAsync({
        plan: editingPlan.plan,
        data: formData,
      });
      setSuccessMessage(result.message);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to update plan:', err);
    }
  };

  const getPlanCardClasses = (planType: PlanType) => {
    const baseClasses = 'rounded-lg border p-4 bg-white dark:bg-gray-800 transition-all hover:shadow-lg';
    switch (planType) {
      case 'FREE':
        return `${baseClasses} border-gray-300 dark:border-gray-600`;
      case 'CLOUD':
        return `${baseClasses} border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900/50`;
      case 'SELF_HOSTED':
        return `${baseClasses} border-green-400 dark:border-green-500`;
      case 'ENTERPRISE':
        return `${baseClasses} border-purple-400 dark:border-purple-500`;
      default:
        return baseClasses;
    }
  };

  const getPlanBadgeClasses = (planType: PlanType) => {
    switch (planType) {
      case 'FREE':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'CLOUD':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
      case 'SELF_HOSTED':
        return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
      case 'ENTERPRISE':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading plans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600 dark:text-red-400">Failed to load plans</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Plans & Pricing</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Configure pricing and resource limits for each plan tier. Changes to limits will
          automatically update all organizations on that plan.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans?.map((plan) => {
          const orgCount = getOrgCountForPlan(plan.plan);

          return (
            <div key={plan.id} className={getPlanCardClasses(plan.plan)}>
              {/* Header with Badge and Org Count */}
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getPlanBadgeClasses(plan.plan)}`}>
                  {plan.plan === 'CLOUD' && <Zap className="w-3 h-3" />}
                  {plan.plan}
                </span>
                <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/30 px-2.5 py-1 rounded-full">
                  <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">{orgCount}</span>
                  <span className="text-xs text-violet-500 dark:text-violet-400">org{orgCount !== 1 && 's'}</span>
                </div>
              </div>

              {/* Plan Name + Price row */}
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{plan.name}</h2>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    ${plan.price.toFixed(0)}
                  </span>
                  {plan.price % 1 !== 0 && (
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      .{plan.price.toFixed(2).split('.')[1]}
                    </span>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
                </div>
              </div>
              {plan.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{plan.description}</p>
              )}

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700 mb-3" />

              {/* Limits with Icons */}
              <div className="space-y-0.5 mb-4">
                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <Globe className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">Sites</span>
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    {plan.limits.sites}
                  </span>
                  <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                </div>

                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <Activity className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">Monitors</span>
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    {plan.limits.checksPerSite}
                  </span>
                  <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                </div>

                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <Server className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">Agents</span>
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    {plan.limits.agents}
                  </span>
                  <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                </div>

                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <Bell className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">Notifications</span>
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    {plan.limits.notificationChannels}
                  </span>
                  <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                </div>

                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <Clock className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">Retention</span>
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    {plan.limits.dataRetention}d
                  </span>
                  <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                </div>
              </div>

              {/* Edit Button */}
              <button
                onClick={() => handleEdit(plan)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md transition-colors font-medium ${
                  plan.plan === 'CLOUD'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Edit2 className="w-4 h-4" />
                Edit Plan
              </button>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Edit {editingPlan.name} Plan
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Success Message */}
              {successMessage && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Monthly Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price || 0}
                      onChange={(e) =>
                        setFormData({ ...formData, price: parseFloat(e.target.value) })
                      }
                      className="w-full pl-7 pr-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700" />

              {/* Plan Limits Header */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Plan Limits
                </h3>
                <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Changing limits will update all existing organizations on this plan.
                  </p>
                </div>
              </div>

              {/* Limits Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sites
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limits?.sites || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        limits: { ...formData.limits!, sites: parseInt(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Monitors per Site
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limits?.checksPerSite || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        limits: { ...formData.limits!, checksPerSite: parseInt(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Agents
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limits?.agents || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        limits: { ...formData.limits!, agents: parseInt(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notification Channels
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limits?.notificationChannels || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        limits: {
                          ...formData.limits!,
                          notificationChannels: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data Retention (days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limits?.dataRetention || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        limits: { ...formData.limits!, dataRetention: parseInt(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePlanMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updatePlanMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
