export const ONBOARDING_VERSION = '2026-onboarding-clean-v5'

export function onboardingStorageKey(userId: string) {
  return `nex_onboarding:${userId}:${ONBOARDING_VERSION}`
}
