import { useEffect } from 'react';

export type SyncEntityType = 'documents' | 'departments' | 'users' | 'tenant';

const EVENT_NAME = 'eka:data-mutated';

interface MutatedEventDetail {
  entity: SyncEntityType;
  timestamp: number;
}

export const dataSync = {
  notify(entity: SyncEntityType) {
    if (typeof window === 'undefined') return;
    const detail: MutatedEventDetail = {
      entity,
      timestamp: Date.now(),
    };
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  },

  subscribe(entities: SyncEntityType[], callback: (entity: SyncEntityType) => void) {
    if (typeof window === 'undefined') return () => {};

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<MutatedEventDetail>;
      if (customEvent.detail && entities.includes(customEvent.detail.entity)) {
        callback(customEvent.detail.entity);
      }
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
    };
  },
};

/**
 * Hook to automatically trigger a refetch callback when specified entities are mutated.
 */
export function useDataSync(
  entities: SyncEntityType[],
  onMutated: (entity: SyncEntityType) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = dataSync.subscribe(entities, onMutated);
    return unsubscribe;
  }, [entities.join(','), onMutated, enabled]);
}
