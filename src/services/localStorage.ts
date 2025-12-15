export type ArchiveType = 'chat' | 'image' | 'presentation' | 'chart';

export interface ArchivedItem {
    id: string;
    type: ArchiveType;
    createdAt: number;
    title?: string;
}

export interface ArchivedChat extends ArchivedItem {
    type: 'chat';
    messages: any[];
    title: string;
}

export interface ArchivedImage extends ArchivedItem {
    type: 'image';
    url: string;
    prompt: string;
    aspectRatio?: string;
}

export interface ArchivedPresentation extends ArchivedItem {
    type: 'presentation';
    content: string;
    title: string;
    slideCount?: number;
}

export interface ArchivedChart extends ArchivedItem {
    type: 'chart';
    title: string;
    chartType: 'bar' | 'line' | 'pie' | 'area';
    colorTheme: string;
    labels: string[];
    values: number[];
    interpretation?: string;
    svgData?: string;
}

export interface ArchiveSettings {
    retentionDays: {
        chat: number;
        image: number;
        presentation: number;
        chart: number;
    };
}

const STORAGE_KEYS = {
    ITEMS: 'rovena_archive_items',
    SETTINGS: 'rovena_archive_settings',
};

const DEFAULT_SETTINGS: ArchiveSettings = {
    retentionDays: {
        chat: 30,
        image: 30,
        presentation: 30,
        chart: 30,
    },
};

export const LocalStorageService = {
    // === SETTINGS ===
    getSettings: (): ArchiveSettings => {
        const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    },

    saveSettings: (settings: ArchiveSettings) => {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    },

    // === ITEMS ===
    getItems: (type?: ArchiveType): ArchivedItem[] => {
        const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
        const items: ArchivedItem[] = saved ? JSON.parse(saved) : [];
        if (type) {
            return items.filter((item) => item.type === type);
        }
        return items.sort((a, b) => b.createdAt - a.createdAt);
    },

    getItemById: (id: string): ArchivedItem | undefined => {
        const items = LocalStorageService.getItems();
        return items.find((item) => item.id === id);
    },

    saveItem: (item: ArchivedItem) => {
        const items = LocalStorageService.getItems();
        const existingIndex = items.findIndex((i) => i.id === item.id);

        let newItems;
        if (existingIndex >= 0) {
            newItems = [...items];
            newItems[existingIndex] = item;
        } else {
            newItems = [item, ...items];
        }

        // Limit local storage size roughly to prevent overflow errors
        // (Just a basic safeguard, browsers have 5-10MB limit)
        if (newItems.length > 500) {
            // Remove oldest items if over limit
            newItems = newItems.slice(0, 500);
        }

        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(newItems));
    },

    deleteItem: (id: string) => {
        const items = LocalStorageService.getItems();
        const newItems = items.filter((item) => item.id !== id);
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(newItems));
    },

    clearAll: () => {
        localStorage.removeItem(STORAGE_KEYS.ITEMS);
    },

    // === CLEANUP ===
    runCleanup: () => {
        const settings = LocalStorageService.getSettings();
        const items = LocalStorageService.getItems();
        const now = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        const newItems = items.filter((item) => {
            const retentionDays = settings.retentionDays[item.type];
            // If retention is 0, keep forever (or treat as distinct logic? Usually 0 means 'don't save' OR 'forever'. 
            // Let's assume user input slider usually has a max. Let's strictly interpret days. 
            // If user wants 'forever', maybe we set a high number or special value -1. 
            // For now, let's treat huge number as forever.

            const itemAgeMs = now - item.createdAt;
            const itemAgeDays = itemAgeMs / ONE_DAY_MS;

            return itemAgeDays <= retentionDays;
        });

        if (newItems.length !== items.length) {
            localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(newItems));
            console.log(`Cleanup removed ${items.length - newItems.length} items.`);
        }
    }
};
