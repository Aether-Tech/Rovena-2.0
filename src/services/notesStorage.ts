export interface Note {
    id: string;
    title: string;
    content: string;
    folderId: string | null;
    tags: string[];
    createdAt: number;
    updatedAt: number;
}

export interface Folder {
    id: string;
    name: string;
    parentId: string | null;
    createdAt: number;
}

const STORAGE_KEYS = {
    NOTES: 'rovena_notes',
    FOLDERS: 'rovena_folders',
};

export const NotesStorage = {
    getNotes: (): Note[] => {
        const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
        const notes: Note[] = saved ? JSON.parse(saved) : [];
        return notes.map(note => ({
            ...note,
            tags: note.tags || []
        })).sort((a, b) => b.updatedAt - a.updatedAt);
    },

    getNoteById: (id: string): Note | undefined => {
        const notes = NotesStorage.getNotes();
        return notes.find(note => note.id === id);
    },

    saveNote: (note: Note) => {
        const notes = NotesStorage.getNotes();
        const existingIndex = notes.findIndex(n => n.id === note.id);

        let newNotes;
        if (existingIndex >= 0) {
            newNotes = [...notes];
            newNotes[existingIndex] = note;
        } else {
            newNotes = [note, ...notes];
        }

        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(newNotes));
    },

    deleteNote: (id: string) => {
        const notes = NotesStorage.getNotes();
        const newNotes = notes.filter(note => note.id !== id);
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(newNotes));
    },

    getFolders: (): Folder[] => {
        const saved = localStorage.getItem(STORAGE_KEYS.FOLDERS);
        const folders: Folder[] = saved ? JSON.parse(saved) : [];
        return folders.sort((a, b) => a.name.localeCompare(b.name));
    },

    getFolderById: (id: string): Folder | undefined => {
        const folders = NotesStorage.getFolders();
        return folders.find(folder => folder.id === id);
    },

    saveFolder: (folder: Folder) => {
        const folders = NotesStorage.getFolders();
        const existingIndex = folders.findIndex(f => f.id === folder.id);

        let newFolders;
        if (existingIndex >= 0) {
            newFolders = [...folders];
            newFolders[existingIndex] = folder;
        } else {
            newFolders = [...folders, folder];
        }

        localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(newFolders));
    },

    deleteFolder: (id: string) => {
        const folders = NotesStorage.getFolders();
        const notes = NotesStorage.getNotes();
        
        const newFolders = folders.filter(folder => folder.id !== id && folder.parentId !== id);
        const newNotes = notes.map(note => 
            note.folderId === id ? { ...note, folderId: null } : note
        );

        localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(newFolders));
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(newNotes));
    },

    getNotesByFolder: (folderId: string | null): Note[] => {
        const notes = NotesStorage.getNotes();
        return notes.filter(note => note.folderId === folderId);
    },

    getSubfolders: (parentId: string | null): Folder[] => {
        const folders = NotesStorage.getFolders();
        return folders.filter(folder => folder.parentId === parentId);
    },
};
