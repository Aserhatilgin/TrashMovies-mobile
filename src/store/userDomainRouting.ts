import type { RootState } from './index';

export type UserDomainBootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';
export type AppRoute = 'loading' | 'auth' | 'main' | 'onboarding' | 'error';

export interface UserDomainRouteState {
  userId: string | null;
  status: UserDomainBootstrapStatus;
  requiredCompleted: boolean | null;
  activeRequestId: string | null;
}

export function emptyUserDomainState(userId: string | null = null): UserDomainRouteState {
  return { userId, status: 'idle', requiredCompleted: null, activeRequestId: null };
}

export function userDomainStateForAuthChange(
  current: UserDomainRouteState,
  nextUserId: string | null,
): UserDomainRouteState {
  if (nextUserId !== null && current.userId === nextUserId) return current;
  return emptyUserDomainState(nextUserId);
}

export function resolveAppRoute(
  auth: { isInitialized: boolean; userId: string | null },
  domain: UserDomainRouteState,
): AppRoute {
  if (!auth.isInitialized) return 'loading';
  if (auth.userId === null) return 'auth';
  if (domain.userId !== auth.userId || domain.status === 'idle' || domain.status === 'loading') {
    return 'loading';
  }
  if (domain.status === 'error') return 'error';
  if (domain.requiredCompleted === true) return 'main';
  if (domain.requiredCompleted === false) return 'onboarding';
  return 'error';
}

export function selectAppRoute(state: RootState): AppRoute {
  return resolveAppRoute(
    { isInitialized: state.auth.isInitialized, userId: state.auth.user?.id ?? null },
    state.userDomain,
  );
}
