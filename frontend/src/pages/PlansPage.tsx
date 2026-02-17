import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, CheckCircle, XCircle, Clock, AlertTriangle, Gift } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  useAvailablePlans,
  useCurrentPlan,
  useCreateCheckoutSession,
  useVerifyCheckoutSession,
  useScheduleDowngrade,
  useCancelDowngrade,
  useStartFreeTrial,
  usePlanHistory,
  planKeys,
} from '@/features/plans/hooks/usePlans';
import { PlanCard } from '@/features/plans/components/PlanCard';
import { DowngradeConfirmModal } from '@/features/plans/components/DowngradeConfirmModal';
import { PlanHistoryTable } from '@/features/plans/components/PlanHistoryTable';
import { PlanType } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

export const PlansPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const { data: availablePlans, isLoading: plansLoading } = useAvailablePlans();
  const { data: currentPlan, isLoading: currentLoading } = useCurrentPlan();
  const { data: history, isLoading: historyLoading } = usePlanHistory();

  const createCheckout = useCreateCheckoutSession();
  const verifyCheckout = useVerifyCheckoutSession();
  const scheduleDowngradeMutation = useScheduleDowngrade();
  const cancelDowngradeMutation = useCancelDowngrade();
  const startTrialMutation = useStartFreeTrial();

  const [downgradePlan, setDowngradePlan] = useState<PlanType | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Handle Stripe redirect callbacks
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      const planParam = searchParams.get('plan');
      const sessionId = searchParams.get('session_id');
      setSearchParams({}, { replace: true });

      if (sessionId) {
        // Verify the payment with backend and activate the plan
        verifyCheckout.mutate(sessionId, {
          onSuccess: (result) => {
            const upgradedPlan = result.plan || planParam;
            if (result.status === 'completed') {
              setBanner({
                type: 'success',
                message: `Payment successful! Your plan has been upgraded to ${upgradedPlan}.`,
              });
            } else {
              setBanner({
                type: 'success',
                message: 'Payment received! Your plan will be activated shortly.',
              });
            }
            // Update the auth store so sidebar reflects the new plan immediately
            if (upgradedPlan && user) {
              setUser({ ...user, plan: upgradedPlan });
            }
          },
          onError: () => {
            setBanner({
              type: 'success',
              message: `Payment successful! Your plan has been upgraded${planParam ? ` to ${planParam}` : ''}.`,
            });
            // Update the auth store so sidebar reflects the new plan
            if (planParam && user) {
              setUser({ ...user, plan: planParam });
            }
            queryClient.invalidateQueries({ queryKey: planKeys.current() });
            queryClient.invalidateQueries({ queryKey: planKeys.history() });
          },
        });
      } else {
        setBanner({
          type: 'success',
          message: `Payment successful! Your plan has been upgraded${planParam ? ` to ${planParam}` : ''}.`,
        });
        queryClient.invalidateQueries({ queryKey: planKeys.current() });
        queryClient.invalidateQueries({ queryKey: planKeys.history() });
      }
    } else if (searchParams.get('cancelled') === 'true') {
      setBanner({ type: 'error', message: 'Payment was cancelled. No changes were made to your plan.' });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, queryClient, setSearchParams]);

  // Keep auth store plan and trial status in sync with the actual current plan
  useEffect(() => {
    if (currentPlan && user) {
      const currentIsTrial = currentPlan.subscription?.isTrial === true && currentPlan.subscription?.status === 'ACTIVE';
      if (user.plan !== currentPlan.plan || user.isTrial !== currentIsTrial) {
        setUser({ ...user, plan: currentPlan.plan, isTrial: currentIsTrial });
      }
    }
  }, [currentPlan?.plan, currentPlan?.subscription?.isTrial, currentPlan?.subscription?.status]);

  // Auto-dismiss banner
  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  const handleUpgrade = async (targetPlan: PlanType) => {
    try {
      const successUrl = `${window.location.origin}/plans?success=true&plan=${targetPlan}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/plans?cancelled=true`;
      const session = await createCheckout.mutateAsync({
        plan: targetPlan,
        successUrl,
        cancelUrl,
      });
      window.location.href = session.url;
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to start checkout';
      setBanner({ type: 'error', message });
    }
  };

  const handleDowngrade = (targetPlan: PlanType) => {
    setDowngradePlan(targetPlan);
  };

  const confirmDowngrade = async () => {
    if (!downgradePlan) return;
    try {
      await scheduleDowngradeMutation.mutateAsync(downgradePlan);
      setDowngradePlan(null);
      setBanner({ type: 'success', message: 'Downgrade scheduled. It will take effect when your current period expires.' });
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to schedule downgrade';
      setBanner({ type: 'error', message });
    }
  };

  const handleCancelDowngrade = async () => {
    try {
      await cancelDowngradeMutation.mutateAsync();
      setBanner({ type: 'success', message: 'Scheduled downgrade has been cancelled.' });
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to cancel downgrade';
      setBanner({ type: 'error', message });
    }
  };

  const handleStartTrial = async () => {
    try {
      await startTrialMutation.mutateAsync();
      setBanner({ type: 'success', message: 'Free trial activated! You now have Cloud plan features for 30 days.' });
      if (user) {
        setUser({ ...user, plan: 'CLOUD', isTrial: true });
      }
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to start free trial';
      setBanner({ type: 'error', message });
    }
  };

  const isAdmin = user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN';
  const activePlan = currentPlan?.plan || (user?.plan as PlanType) || 'FREE';
  const subscription = currentPlan?.subscription;
  const hasScheduledDowngrade = subscription?.status === 'DOWNGRADE_SCHEDULED';
  const isTrialEligible = activePlan === 'FREE' && !currentPlan?.freeTrialUsedAt;
  const isOnTrial = subscription?.isTrial === true && subscription?.status === 'ACTIVE';

  return (
    <div className="space-y-6">
      {/* Header with current plan info */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-7 w-7 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plans & Billing</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your subscription and billing
            </p>
          </div>
        </div>
        {subscription && (
          <div className={`flex items-center gap-3 rounded-lg px-5 py-3 border ${
            isOnTrial
              ? 'bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-700'
              : 'bg-purple-100 dark:bg-purple-900/40 border-purple-200 dark:border-purple-700'
          }`}>
            <div>
              <p className={`text-xs font-medium uppercase tracking-wide ${
                isOnTrial ? 'text-green-500 dark:text-green-400' : 'text-purple-500 dark:text-purple-400'
              }`}>
                {isOnTrial ? 'Free Trial' : 'Current Plan'}
              </p>
              <p className={`text-xl font-bold ${
                isOnTrial ? 'text-green-900 dark:text-green-100' : 'text-purple-900 dark:text-purple-100'
              }`}>
                {{ FREE: 'Free', CLOUD: 'Cloud', SELF_HOSTED: 'Self-Hosted', ENTERPRISE: 'Enterprise' }[subscription.plan] || subscription.plan}
              </p>
            </div>
            <div className={`w-px h-10 mx-1 ${isOnTrial ? 'bg-green-300 dark:bg-green-600' : 'bg-purple-300 dark:bg-purple-600'}`} />
            <div className="flex items-center gap-2">
              {isOnTrial ? (
                <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              )}
              <div>
                <p className={`text-lg font-bold leading-tight ${
                  isOnTrial ? 'text-green-700 dark:text-green-300' : 'text-purple-700 dark:text-purple-300'
                }`}>
                  {subscription.daysRemaining} <span className="text-sm font-medium">days left</span>
                </p>
                <p className={`text-xs ${isOnTrial ? 'text-green-500 dark:text-green-500' : 'text-purple-500 dark:text-purple-500'}`}>
                  {isOnTrial ? 'trial ' : ''}expires {new Date(subscription.expiresAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scheduled downgrade notice */}
      {hasScheduledDowngrade && subscription && (
        <div className="flex items-center justify-between flex-wrap gap-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-5 py-3">
          <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            <AlertTriangle className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Downgrade to {subscription.scheduledPlan} scheduled at period end
          </span>
          <button
            onClick={handleCancelDowngrade}
            disabled={cancelDowngradeMutation.isPending}
            className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 font-medium"
          >
            Cancel Downgrade
          </button>
        </div>
      )}

      {/* Banners */}
      {banner && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 ${
            banner.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <p className="text-sm">{banner.message}</p>
          <button
            onClick={() => setBanner(null)}
            className="ml-auto text-sm font-medium hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Plan Cards */}
      {plansLoading || currentLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {availablePlans?.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentPlan={activePlan}
              isLoading={createCheckout.isPending || scheduleDowngradeMutation.isPending}
              onUpgrade={handleUpgrade}
              onDowngrade={handleDowngrade}
              isTrialEligible={plan.plan === 'CLOUD' ? isTrialEligible : false}
              isOnTrial={plan.plan === 'CLOUD' ? isOnTrial : false}
              onStartTrial={handleStartTrial}
              isTrialLoading={startTrialMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Non-admin notice */}
      {!isAdmin && (
        <div className="rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Only organization administrators can change plans. Contact your admin to upgrade, or reach out to{' '}
            <a href="mailto:support@hexascan.app" className="text-purple-600 dark:text-purple-400 hover:underline font-medium">
              support@hexascan.app
            </a>{' '}
            for help.
          </p>
        </div>
      )}

      {/* Plan History */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Plan History</h2>
        <PlanHistoryTable history={history} isLoading={historyLoading} />
      </div>

      {/* Downgrade Confirm Modal */}
      <DowngradeConfirmModal
        isOpen={downgradePlan !== null}
        onClose={() => setDowngradePlan(null)}
        onConfirm={confirmDowngrade}
        isLoading={scheduleDowngradeMutation.isPending}
        currentPlan={availablePlans?.find((p) => p.plan === activePlan)}
        targetPlan={availablePlans?.find((p) => p.plan === downgradePlan)}
        daysRemaining={subscription?.daysRemaining ?? null}
      />
    </div>
  );
};
