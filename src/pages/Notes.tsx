import { useState, useEffect } from 'react';
import {
    FileText,
    Folder as FolderIcon,
    FolderPlus,
    FilePlus,
    ChevronRight,
    ChevronDown,
    Trash2,
    Edit2,
    Search,
    X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NotesStorage, type Note, type Folder } from '../services/notesStorage';
import { Modal } from '../components/Modal/Modal';
import './Notes.css';

export function Notes() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [showNewNoteModal, setShowNewNoteModal] = useState(false);
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameTarget, setRenameTarget] = useState<{ type: 'note' | 'folder', id: string, name: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setNotes(NotesStorage.getNotes());
        setFolders(NotesStorage.getFolders());
    };

    const handleCreateNote = () => {
        const newNote: Note = {
            id: `note_${Date.now()}`,
            title: 'Nova Nota',
            content: '',
            folderId: selectedFolder,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        NotesStorage.saveNote(newNote);
        loadData();
        setSelectedNote(newNote);
        setIsEditing(true);
        setEditTitle(newNote.title);
        setEditContent(newNote.content);
        setShowNewNoteModal(false);
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        const newFolder: Folder = {
            id: `folder_${Date.now()}`,
            name: newFolderName,
            parentId: selectedFolder,
            createdAt: Date.now(),
        };
        NotesStorage.saveFolder(newFolder);
        loadData();
        setExpandedFolders(prev => new Set(prev).add(selectedFolder || 'root'));
        setNewFolderName('');
        setShowNewFolderModal(false);
    };

    const handleSaveNote = () => {
        if (!selectedNote) return;
        const updatedNote: Note = {
            ...selectedNote,
            title: editTitle,
            content: editContent,
            updatedAt: Date.now(),
        };
        NotesStorage.saveNote(updatedNote);
        setSelectedNote(updatedNote);
        setIsEditing(false);
        loadData();
    };

    const handleDeleteNote = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir esta nota?')) {
            NotesStorage.deleteNote(id);
            if (selectedNote?.id === id) {
                setSelectedNote(null);
            }
            loadData();
        }
    };

    const handleDeleteFolder = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir esta pasta? As notas serão movidas para a raiz.')) {
            NotesStorage.deleteFolder(id);
            if (selectedFolder === id) {
                setSelectedFolder(null);
            }
            loadData();
        }
    };

    const handleRename = () => {
        if (!renameTarget) return;
        
        if (renameTarget.type === 'note') {
            const note = NotesStorage.getNoteById(renameTarget.id);
            if (note) {
                NotesStorage.saveNote({ ...note, title: renameTarget.name, updatedAt: Date.now() });
            }
        } else {
            const folder = NotesStorage.getFolderById(renameTarget.id);
            if (folder) {
                NotesStorage.saveFolder({ ...folder, name: renameTarget.name });
            }
        }
        
        loadData();
        setShowRenameModal(false);
        setRenameTarget(null);
    };

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    const renderFolderTree = (parentId: string | null, level: number = 0) => {
        const subfolders = NotesStorage.getSubfolders(parentId);
        const folderNotes = NotesStorage.getNotesByFolder(parentId);

        return (
            <>
                {subfolders.map(folder => {
                    const isExpanded = expandedFolders.has(folder.id);
                    return (
                        <div key={folder.id} style={{ marginLeft: level * 16 }}>
                            <div
                                className={`folder-item ${selectedFolder === folder.id ? 'selected' : ''}`}
                                onClick={() => setSelectedFolder(folder.id)}
                            >
                                <button
                                    className="folder-toggle"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFolder(folder.id);
                                    }}
                                >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <FolderIcon size={16} />
                                <span className="folder-name">{folder.name}</span>
                                <div className="folder-actions">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setRenameTarget({ type: 'folder', id: folder.id, name: folder.name });
                                            setShowRenameModal(true);
                                        }}
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button onClick={(e) => handleDeleteFolder(folder.id, e)}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            {isExpanded && renderFolderTree(folder.id, level + 1)}
                        </div>
                    );
                })}
                {folderNotes.filter(note => {
                    if (!searchTerm) return true;
                    const search = searchTerm.toLowerCase();
                    return note.title.toLowerCase().includes(search) || 
                           note.content.toLowerCase().includes(search);
                }).map(note => (
                    <div
                        key={note.id}
                        className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                        style={{ marginLeft: level * 16 + 16 }}
                        onClick={() => {
                            setSelectedNote(note);
                            setIsEditing(false);
                        }}
                    >
                        <FileText size={16} />
                        <span className="note-title">{note.title}</span>
                        <div className="note-actions">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setRenameTarget({ type: 'note', id: note.id, name: note.title });
                                    setShowRenameModal(true);
                                }}
                            >
                                <Edit2 size={12} />
                            </button>
                            <button onClick={(e) => handleDeleteNote(note.id, e)}>
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </>
        );
    };

    return (
        <div className="notes-page page-content">
            <div className="notes-container">
                <div className="notes-sidebar">
                    <div className="sidebar-header">
                        <h2>Notas</h2>
                        <div className="sidebar-actions">
                            <button
                                className="icon-btn"
                                onClick={() => setShowNewNoteModal(true)}
                                title="Nova nota"
                            >
                                <FilePlus size={18} />
                            </button>
                            <button
                                className="icon-btn"
                                onClick={() => setShowNewFolderModal(true)}
                                title="Nova pasta"
                            >
                                <FolderPlus size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="search-bar">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Buscar notas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="clear-search" onClick={() => setSearchTerm('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="notes-tree">
                        {renderFolderTree(null)}
                    </div>
                </div>

                  <div className="notes-content">
                      {selectedNote ? (
                          <div className="note-viewer">
                              {isEditing ? (
                                  <div className="note-editor">
                                      <input
                                          type="text"
                                          className="title-input"
                                          value={editTitle}
                                          onChange={(e) => setEditTitle(e.target.value)}
                                          placeholder="Título da nota"
                                      />
                                      <textarea
                                          className="content-input"
                                          value={editContent}
                                          onChange={(e) => setEditContent(e.target.value)}
                                          placeholder="Escreva sua nota em Markdown..."
                                      />
                                      <div className="editor-actions">
                                          <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                                              Cancelar
                                          </button>
                                          <button className="btn btn-primary" onClick={handleSaveNote}>
                                              Salvar
                                          </button>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="markdown-content">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                          {selectedNote.content}
                                      </ReactMarkdown>
                                  </div>
                              )}
                          </div>
                    ) : (
                        <div className="empty-state">
                            <FileText size={64} />
                            <h2>Nenhuma nota selecionada</h2>
                            <p>Selecione uma nota ou crie uma nova para começar</p>
                            <button className="btn btn-primary" onClick={() => setShowNewNoteModal(true)}>
                                <FilePlus size={16} /> Criar Nova Nota
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={showNewNoteModal}
                onClose={() => setShowNewNoteModal(false)}
                title="Nova Nota"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowNewNoteModal(false)}>
                            Cancelar
                        </button>
                        <button className="btn btn-primary" onClick={handleCreateNote}>
                            Criar
                        </button>
                    </>
                }
            >
                <p>Uma nova nota será criada {selectedFolder ? 'na pasta atual' : 'na raiz'}.</p>
            </Modal>

            <Modal
                isOpen={showNewFolderModal}
                onClose={() => {
                    setShowNewFolderModal(false);
                    setNewFolderName('');
                }}
                title="Nova Pasta"
                footer={
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setShowNewFolderModal(false);
                                setNewFolderName('');
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleCreateFolder}
                            disabled={!newFolderName.trim()}
                        >
                            Criar
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label>Nome da pasta:</label>
                    <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Digite o nome da pasta..."
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newFolderName.trim()) {
                                handleCreateFolder();
                            }
                        }}
                    />
                </div>
            </Modal>

            <Modal
                isOpen={showRenameModal}
                onClose={() => {
                    setShowRenameModal(false);
                    setRenameTarget(null);
                }}
                title={`Renomear ${renameTarget?.type === 'note' ? 'Nota' : 'Pasta'}`}
                footer={
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setShowRenameModal(false);
                                setRenameTarget(null);
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleRename}
                            disabled={!renameTarget?.name.trim()}
                        >
                            Renomear
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label>Novo nome:</label>
                    <input
                        type="text"
                        value={renameTarget?.name || ''}
                        onChange={(e) => setRenameTarget(renameTarget ? { ...renameTarget, name: e.target.value } : null)}
                        placeholder="Digite o novo nome..."
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && renameTarget?.name.trim()) {
                                handleRename();
                            }
                        }}
                    />
                </div>
            </Modal>
        </div>
    );
}

export default Notes;
