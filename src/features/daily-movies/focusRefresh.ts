import { istanbulDate } from '../../utils/istanbulDate.ts';

type DailyRequest = Promise<unknown> & { abort: () => void };
interface FocusRefreshOptions {
  load: () => DailyRequest | null;
  onDateChange: (date: string) => void;
  subscribeActive: (onActive: () => void) => () => void;
}

// Native events are injected so tests can exercise the real focus lifecycle
// together with the Redux reducer and a controlled clock.
export function startDailyMovieRefresh({ load, onDateChange, subscribeActive }: FocusRefreshOptions): () => void {
  const pending = new Set<DailyRequest>();
  let observedDate = '';
  let disposed = false;
  let timer: ReturnType<typeof setTimeout>;
  const refresh = () => {
    if (disposed) return;
    observedDate = istanbulDate(new Date());
    onDateChange(observedDate);
    const request = load();
    if (!request) return;
    pending.add(request);
    void request.then(() => pending.delete(request), () => pending.delete(request));
  };
  const schedule = () => {
    if (disposed) return;
    // Align to minute boundaries, including Istanbul midnight.
    timer = setTimeout(() => {
      if (istanbulDate(new Date()) !== observedDate) refresh();
      schedule();
    }, 60_000 - Date.now() % 60_000);
  };
  refresh();
  schedule();
  const unsubscribe = subscribeActive(refresh);
  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    clearTimeout(timer);
    pending.forEach((request) => request.abort());
  };
}
