export { };

declare global {
    interface Window {
        electronAPI: {
            getAppVersion: () => Promise<string>;
            checkForUpdates: () => Promise<void>;
            onUpdateStatus: (callback: (status: any) => void) => void;
            removeUpdateStatusListener: (callback: (status: any) => void) => void;
        };
    }
}
