import { useState, useEffect } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  isStoragePersisted: boolean;
  checkStoragePersistence: () => Promise<boolean>;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [isStoragePersisted, setIsStoragePersisted] = useState<boolean>(false);

  const checkStoragePersistence = async (): Promise<boolean> => {
    if (typeof window !== 'undefined' && 'storage' in navigator && navigator.storage?.persisted) {
      try {
        const persisted = await navigator.storage.persisted();
        setIsStoragePersisted(persisted);
        return persisted;
      } catch {
        return false;
      }
    }
    return false;
  };

  useEffect(() => {
    checkStoragePersistence();

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Auto clear wasOffline message after 6 seconds
      const timer = setTimeout(() => {
        setWasOffline(false);
      }, 6000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    wasOffline,
    isStoragePersisted,
    checkStoragePersistence,
  };
}
