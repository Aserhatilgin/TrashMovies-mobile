import { supabase } from '../lib/supabase';

export type OnboardingStatus =
  | 'not_configured'
  | 'not_required'
  | 'not_started'
  | 'in_progress'
  | 'completed';

export interface UserDomainProfile {
  id: string;
  displayName: string | null;
  avatarKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserOnboardingProgress {
  userId: string;
  onboardingVersion: number;
  currentStep: string | null;
  responses: Record<string, unknown>;
  revision: number;
  startedAt: string | null;
  completedAt: string | null;
  completionSource: 'user' | 'legacy_exemption' | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDomainBootstrap {
  profile: UserDomainProfile;
  onboarding: {
    requiredVersion: number | null;
    requiredCompleted: boolean;
    latestVersion: number | null;
    latestCompleted: boolean;
    status: OnboardingStatus;
    requiredProgress: UserOnboardingProgress | null;
    latestProgress: UserOnboardingProgress | null;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableVersion(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) > 0);
}

export function parseUserOnboardingProgress(value: unknown): UserOnboardingProgress | null {
  if (value === null) return null;
  if (!isObject(value)
    || typeof value.user_id !== 'string'
    || !isNullableVersion(value.onboarding_version)
    || value.onboarding_version === null
    || !isNullableString(value.current_step)
    || !isObject(value.responses)
    || !Number.isSafeInteger(value.revision)
    || (value.revision as number) < 0
    || !isNullableString(value.started_at)
    || !isNullableString(value.completed_at)
    || !(value.completion_source === null || value.completion_source === 'user' || value.completion_source === 'legacy_exemption')
    || typeof value.created_at !== 'string'
    || typeof value.updated_at !== 'string') {
    throw new Error('Invalid user-domain progress response.');
  }
  return {
    userId: value.user_id,
    onboardingVersion: value.onboarding_version,
    currentStep: value.current_step,
    responses: value.responses,
    revision: value.revision as number,
    startedAt: value.started_at,
    completedAt: value.completed_at,
    completionSource: value.completion_source,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function parseUserDomain(value: unknown): UserDomainBootstrap {
  if (!isObject(value) || !isObject(value.profile) || !isObject(value.onboarding)) {
    throw new Error('Invalid user-domain response.');
  }
  const { profile, onboarding } = value;
  const validStatuses: readonly OnboardingStatus[] = [
    'not_configured', 'not_required', 'not_started', 'in_progress', 'completed',
  ];
  if (typeof profile.id !== 'string'
    || !isNullableString(profile.display_name)
    || typeof profile.avatar_key !== 'string'
    || typeof profile.created_at !== 'string'
    || typeof profile.updated_at !== 'string'
    || !isNullableVersion(onboarding.required_version)
    || typeof onboarding.required_completed !== 'boolean'
    || !isNullableVersion(onboarding.latest_version)
    || typeof onboarding.latest_completed !== 'boolean'
    || !validStatuses.includes(onboarding.status as OnboardingStatus)) {
    throw new Error('Invalid user-domain response.');
  }
  return {
    profile: {
      id: profile.id,
      displayName: profile.display_name,
      avatarKey: profile.avatar_key,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    },
    onboarding: {
      requiredVersion: onboarding.required_version,
      requiredCompleted: onboarding.required_completed,
      latestVersion: onboarding.latest_version,
      latestCompleted: onboarding.latest_completed,
      status: onboarding.status as OnboardingStatus,
      requiredProgress: parseUserOnboardingProgress(onboarding.required_progress),
      latestProgress: parseUserOnboardingProgress(onboarding.latest_progress),
    },
  };
}

export async function initializeUserDomain(signal?: AbortSignal): Promise<UserDomainBootstrap> {
  const query = supabase.rpc('initialize_user_domain');
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  return parseUserDomain(data);
}
