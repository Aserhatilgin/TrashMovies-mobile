import {
  completionRevisionForRetry, completionSnapshot, responseForSave,
  type FlowStep, type OnboardingDraft, type PendingCompletion,
} from './onboardingV1.ts';
import type { UserDomainBootstrap, UserOnboardingProgress } from '../../services/userDomain';

export interface OnboardingServices {
  currentUserId: () => string | null;
  initialize: (signal: AbortSignal) => Promise<UserDomainBootstrap>;
  save: (version: number, revision: number, draft: OnboardingDraft, step: string, signal: AbortSignal) => Promise<UserOnboardingProgress>;
  complete: (version: number, revision: number, signal: AbortSignal) => Promise<UserOnboardingProgress>;
}

export type SubmissionResult =
  | { kind: 'saved'; revision: number }
  | { kind: 'completed'; responses: Record<string, unknown> }
  | { kind: 'reconciled'; domain: UserDomainBootstrap };

export class ObsoleteOnboardingOperation extends Error {}

export function onboardingErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
}

// One instance belongs to one mounted user's flow. A generation also separates
// effect cleanup/restart (including React Strict Mode) from older continuations.
export class OnboardingOperations {
  private generation = 0;
  private abort = new AbortController();
  private working = false;
  private pending: PendingCompletion | null = null;
  private version: number | null = null;
  private completedDomain: UserDomainBootstrap | null = null;
  readonly userId: string;
  readonly preview: boolean;
  private readonly services: OnboardingServices;
  revision = 0;

  constructor(
    userId: string,
    preview: boolean,
    services: OnboardingServices,
  ) {
    this.userId = userId;
    this.preview = preview;
    this.services = services;
  }

  activate(): void {
    this.invalidate();
    this.abort = new AbortController();
    this.working = false;
  }

  invalidate(): void {
    this.generation += 1;
    this.abort.abort();
    this.working = false;
  }

  capture(): number { return this.generation; }
  get busy(): boolean { return this.working; }

  isCurrent(generation: number): boolean {
    return generation === this.generation && !this.abort.signal.aborted
      && this.services.currentUserId() === this.userId;
  }

  private assertCurrent(generation: number): void {
    if (!this.isCurrent(generation)) throw new ObsoleteOnboardingOperation();
  }

  async network<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const generation = this.capture();
    this.assertCurrent(generation);
    try {
      const value = await operation(this.abort.signal);
      this.assertCurrent(generation);
      return value;
    } catch (error) {
      this.assertCurrent(generation);
      throw error;
    }
  }

  private async exclusive<T>(operation: (check: () => void) => Promise<T>): Promise<T | null> {
    const generation = this.capture();
    if (this.working || !this.isCurrent(generation)) return null;
    this.working = true;
    try {
      const value = await operation(() => this.assertCurrent(generation));
      this.assertCurrent(generation);
      return value;
    } finally {
      if (this.isCurrent(generation)) this.working = false;
    }
  }

  private async authoritativeDomain(): Promise<UserDomainBootstrap> {
    const generation = this.capture();
    const domain = await this.network((signal) => this.services.initialize(signal));
    this.assertCurrent(generation);
    if (domain.profile.id !== this.userId) throw new Error('User-domain identity mismatch.');
    return domain;
  }

  async initialize(): Promise<UserDomainBootstrap | null> {
    if (this.preview) return null;
    return this.exclusive(async (check) => {
      const domain = await this.authoritativeDomain();
      check();
      this.completedDomain = domain.onboarding.requiredCompleted ? domain : null;
      if (!domain.onboarding.requiredCompleted) {
        const progress = domain.onboarding.requiredProgress;
        if (domain.onboarding.requiredVersion !== 1 || !progress || progress.userId !== this.userId
          || progress.onboardingVersion !== 1 || progress.completedAt) throw new Error('Unavailable V1 draft.');
        this.version = 1;
        this.revision = progress.revision;
      }
      this.pending = null;
      return domain;
    });
  }

  private async reconcile(): Promise<SubmissionResult | null> {
    const generation = this.capture();
    const domain = await this.authoritativeDomain();
    this.assertCurrent(generation);
    this.completedDomain = domain.onboarding.requiredCompleted ? domain : null;
    return domain.onboarding.requiredCompleted ? { kind: 'reconciled', domain } : null;
  }

  async submit(draft: OnboardingDraft, step: FlowStep, finish: boolean): Promise<SubmissionResult | null> {
    return this.exclusive(async (check) => {
      if (this.preview) return finish
        ? { kind: 'completed', responses: { ...responseForSave(draft) } }
        : { kind: 'saved', revision: this.revision };
      if (this.completedDomain) return { kind: 'reconciled', domain: this.completedDomain };
      if (this.version !== 1) throw new Error('Required V1 has not been initialized.');

      // Keep uncertainty across Back/edits. Never resave a possibly completed row
      // until the initializer confirms that it is still incomplete.
      if (this.pending) {
        const reconciled = await this.reconcile();
        check();
        if (reconciled) return reconciled;
      }
      const retryRevision = finish ? completionRevisionForRetry(this.pending, draft) : null;
      if (retryRevision === null) {
        try {
          const saved = await this.network((signal) => this.services.save(1, this.revision, responseForSave(draft), step, signal));
          check();
          if (saved.userId !== this.userId || saved.onboardingVersion !== 1 || saved.currentStep !== step) {
            throw new Error('Saved progress did not match this session.');
          }
          this.revision = saved.revision;
          this.pending = null;
        } catch (error) {
          check();
          if (onboardingErrorCode(error) === '55000') {
            const reconciled = await this.reconcile();
            check();
            if (reconciled) return reconciled;
          }
          throw error;
        }
      }
      if (!finish) return { kind: 'saved', revision: this.revision };
      this.pending = { revision: retryRevision ?? this.revision, snapshot: completionSnapshot(draft) };
      try {
        const completed = await this.network((signal) => this.services.complete(1, this.pending!.revision, signal));
        check();
        if (completed.userId !== this.userId || completed.onboardingVersion !== 1 || !completed.completedAt) {
          throw new Error('Completion was not confirmed for this session.');
        }
        this.pending = null;
        return { kind: 'completed', responses: completed.responses };
      } catch (error) {
        check();
        if (error instanceof ObsoleteOnboardingOperation) throw error;
        // Includes a lost response after a committed completion. If this read
        // also fails, retain pending uncertainty for the next intentional action.
        const reconciled = await this.reconcile();
        check();
        if (reconciled) return reconciled;
        throw error;
      }
    });
  }
}
