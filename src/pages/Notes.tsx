import type React from 'react';
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
    Tag,
    Network,
    List,
    GripVertical,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from 'react-beautiful-dnd';
import { wrappingInputRule } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import { NotesStorage, type Note, type Folder } from '../services/notesStorage';
import { Modal } from '../components/Modal/Modal';
import { GraphView } from '../components/GraphView';
import './Notes.css';

const DEFAULT_NOTE_TITLE = 'Nova Nota';

const extractTitleFromContent = (content: string, fallback: string): string => {
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const headingMatch = trimmed.match(/^(#+)\s*(.*)$/);
        const title = headingMatch ? headingMatch[2].trim() : trimmed;
        if (title) return title;
    }
    return fallback;
};

const syncHeadingWithTitle = (content: string, title: string): string => {
    const lines = content.split('\n');
    const firstContentIndex = lines.findIndex((line) => line.trim() !== '');

    if (firstContentIndex === -1) {
        return `# ${title}\n\n`;
    }

    const firstLine = lines[firstContentIndex];
    const headingMatch = firstLine.match(/^(#+)\s*(.*)$/);

    if (headingMatch) {
        lines[firstContentIndex] = `${headingMatch[1]} ${title}`;
    } else {
        lines[firstContentIndex] = `# ${title}`;
    }

    return lines.join('\n');
};

const TiptapEditor = ({ content, onChange }: { content: string; onChange: (content: string) => void }) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4, 5, 6],
                },
            }),
            TaskList.configure({
                HTMLAttributes: {
                    class: 'task-list',
                },
            }),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: {
                    class: 'task-item',
                },
            }).extend({
                addInputRules() {
                    return [
                        wrappingInputRule({
                            find: /^-\[([ x])\]\s$/,
                            type: this.type,
                            getAttributes: (match) => ({
                                checked: match[1] === 'x',
                            }),
                        }),
                    ];
                },
            }),
            Markdown.configure({
                transformPastedText: true,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            const markdown = (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
            onChange(markdown);
        },
        editorProps: {
            attributes: {
                class: 'markdown-content focus:outline-none h-full',
                'data-placeholder': 'Digite -[ ] e pressione espaço para criar checkbox',
            },
        },
    });

    useEffect(() => {
        if (editor) {
            const currentMarkdown = (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
            if (content !== currentMarkdown) {
                editor.commands.setContent(content);
            }
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    return <EditorContent editor={editor} className="tiptap-container" />;
};

export function Notes() {
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewNoteModal, setShowNewNoteModal] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState(DEFAULT_NOTE_TITLE);
    const [tagInput, setTagInput] = useState('');
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameTarget, setRenameTarget] = useState<{ type: 'note' | 'folder'; id: string; name: string } | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
    const [, forceUpdate] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        forceUpdate({});
    };

    const handleCreateNote = () => {
        const title = newNoteTitle.trim() || DEFAULT_NOTE_TITLE;
        const contentWithHeading = syncHeadingWithTitle('', title);

        const newNote: Note = {
            id: `note_${Date.now()}`,
            title,
            content: contentWithHeading,
            folderId: selectedFolder,
            tags: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        NotesStorage.saveNote(newNote);
        loadData();
        setSelectedNote(newNote);
        setShowNewNoteModal(false);
        setNewNoteTitle(DEFAULT_NOTE_TITLE);
        setTagInput('');
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
        setExpandedFolders((prev) => new Set(prev).add(selectedFolder || 'root'));
        setNewFolderName('');
        setShowNewFolderModal(false);
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
                const updatedContent = syncHeadingWithTitle(note.content, renameTarget.name.trim() || DEFAULT_NOTE_TITLE);
                NotesStorage.saveNote({
                    ...note,
                    title: renameTarget.name,
                    content: updatedContent,
                    updatedAt: Date.now(),
                });
                if (selectedNote?.id === note.id) {
                    const refreshedNote = { ...note, title: renameTarget.name, content: updatedContent, updatedAt: Date.now() };
                    setSelectedNote(refreshedNote);
                }
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
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

      const extractParentId = (droppableId: string, type: 'folder' | 'note'): string | null => {
          const prefix = `${type}-`;
          if (!droppableId.startsWith(prefix)) return null;
          const value = droppableId.slice(prefix.length);
          if (value === 'root' || value === '') return null;
          return value;
      };

    const isInvalidFolderMove = (folderId: string, targetParentId: string | null) => {
        if (!targetParentId) return false;
        if (folderId === targetParentId) return true;

        let current = NotesStorage.getFolderById(targetParentId);
        while (current) {
            if (current.id === folderId) return true;
            current = current.parentId ? NotesStorage.getFolderById(current.parentId) : undefined;
        }
        return false;
    };

    const handleDragEnd = (result: DropResult) => {
        const { destination, source, draggableId, type } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        if (type === 'folder') {
            const folder = NotesStorage.getFolderById(draggableId);
            if (!folder) return;

            const newParentId = extractParentId(destination.droppableId, 'folder');
            if (isInvalidFolderMove(draggableId, newParentId)) return;

            NotesStorage.saveFolder({
                ...folder,
                parentId: newParentId,
            });
            loadData();
        } else if (type === 'note') {
            const note = NotesStorage.getNoteById(draggableId);
            if (!note) return;

            const newFolderId = extractParentId(destination.droppableId, 'note');

            NotesStorage.saveNote({
                ...note,
                folderId: newFolderId,
                updatedAt: Date.now(),
            });
            loadData();
        }
    };

    const renderFolderTree = (parentId: string | null, level: number = 0) => {
        const subfolders = NotesStorage.getSubfolders(parentId);
        const folderNotes = NotesStorage.getNotesByFolder(parentId);
        const folderDroppableId = `folder-${parentId || 'root'}`;
        const noteDroppableId = `note-${parentId || 'root'}`;

        const filteredNotes = folderNotes.filter((note) => {
            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            return note.title.toLowerCase().includes(search) || note.content.toLowerCase().includes(search);
        });

        return (
            <Droppable droppableId={folderDroppableId} type="folder" isDropDisabled={false}>
                {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                        {subfolders.map((folder, index) => {
                            const isExpanded = expandedFolders.has(folder.id);
                            return (
                                <Draggable key={folder.id} draggableId={folder.id} index={index}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            style={{
                                                marginLeft: level * 16,
                                                ...provided.draggableProps.style,
                                            }}
                                        >
                                            <div
                                                className={`folder-item ${selectedFolder === folder.id ? 'selected' : ''} ${
                                                    snapshot.isDragging ? 'dragging' : ''
                                                }`}
                                                onClick={() => setSelectedFolder(folder.id)}
                                            >
                                                <div {...provided.dragHandleProps} className="drag-handle">
                                                    <GripVertical size={14} />
                                                </div>
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
                                    )}
                                </Draggable>
                            );
                        })}
                        {provided.placeholder}
                        <Droppable droppableId={noteDroppableId} type="note">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                    {filteredNotes.map((note, index) => (
                                        <Draggable key={note.id} draggableId={note.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''} ${
                                                        snapshot.isDragging ? 'dragging' : ''
                                                    }`}
                                                    style={{
                                                        marginLeft: level * 16 + 16,
                                                        ...provided.draggableProps.style,
                                                    }}
                                                    onClick={() => {
                                                        setSelectedNote(note);
                                                    }}
                                                >
                                                    <div {...provided.dragHandleProps} className="drag-handle">
                                                        <GripVertical size={14} />
                                                    </div>
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
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                )}
            </Droppable>
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
                                  className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
                                  onClick={() => setViewMode('list')}
                                  title="Visualização em lista"
                              >
                                  <List size={18} />
                              </button>
                              <button
                                  className={`icon-btn ${viewMode === 'graph' ? 'active' : ''}`}
                                  onClick={() => setViewMode('graph')}
                                  title="Visualização em grafo"
                              >
                                  <Network size={18} />
                              </button>
                              <button
                                  className="icon-btn"
                                  onClick={() => {
                                      setNewNoteTitle(DEFAULT_NOTE_TITLE);
                                      setShowNewNoteModal(true);
                                  }}
                                  title="Nova nota"
                              >
                                  <FilePlus size={18} />
                              </button>
                              <button className="icon-btn" onClick={() => setShowNewFolderModal(true)} title="Nova pasta">
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

                        <DragDropContext onDragEnd={handleDragEnd}>
                            <div className="notes-tree">{renderFolderTree(null)}</div>
                        </DragDropContext>
                    </div>


                    <div className="notes-content">
                        {viewMode === 'graph' ? (
                            <GraphView
                                notes={NotesStorage.getNotes()}
                                folders={NotesStorage.getFolders()}
                                onNodeClick={(nodeId, type) => {
                                    if (type === 'note') {
                                        const note = NotesStorage.getNoteById(nodeId);
                                        if (note) setSelectedNote(note);
                                    } else {
                                        setSelectedFolder(nodeId);
                                        setViewMode('list');
                                    }
                                }}
                            />
                        ) : selectedNote ? (
                          <div className="note-editor-wrapper">
                              <div className="note-tags-section">
                                  <div className="tags-list">
                                      {selectedNote.tags.map((tag, index) => (
                                          <span key={index} className="tag-item">
                                              <Tag size={12} />
                                              {tag}
                                              <button
                                                  className="tag-remove"
                                                  onClick={() => {
                                                      const updatedTags = selectedNote.tags.filter((_, i) => i !== index);
                                                      const updatedNote = {
                                                          ...selectedNote,
                                                          tags: updatedTags,
                                                          updatedAt: Date.now(),
                                                      };
                                                      NotesStorage.saveNote(updatedNote);
                                                      setSelectedNote(updatedNote);
                                                      loadData();
                                                  }}
                                              >
                                                  <X size={12} />
                                              </button>
                                          </span>
                                      ))}
                                  </div>
                                  <input
                                      type="text"
                                      value={tagInput}
                                      onChange={(e) => setTagInput(e.target.value)}
                                      placeholder="Digite uma tag e pressione Enter..."
                                      className="tag-input"
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' && tagInput.trim()) {
                                              e.preventDefault();
                                              if (!selectedNote.tags.includes(tagInput.trim())) {
                                                  const updatedTags = [...selectedNote.tags, tagInput.trim()];
                                                  const updatedNote = {
                                                      ...selectedNote,
                                                      tags: updatedTags,
                                                      updatedAt: Date.now(),
                                                  };
                                                  NotesStorage.saveNote(updatedNote);
                                                  setSelectedNote(updatedNote);
                                                  loadData();
                                              }
                                              setTagInput('');
                                          }
                                      }}
                                  />
                              </div>
                              <TiptapEditor
                                  key={selectedNote.id}
                                  content={selectedNote.content}
                                  onChange={(content) => {
                                      const newTitle = extractTitleFromContent(content, selectedNote.title || DEFAULT_NOTE_TITLE);
                                      const updatedNote = {
                                          ...selectedNote,
                                          title: newTitle,
                                          content,
                                          updatedAt: Date.now(),
                                      };
                                      NotesStorage.saveNote(updatedNote);
                                      setSelectedNote(updatedNote);
                                      loadData();
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="empty-state">
                                <FileText size={64} />
                                <h2>Nenhuma nota selecionada</h2>
                                <p>Selecione uma nota ou crie uma nova para começar</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setNewNoteTitle(DEFAULT_NOTE_TITLE);
                                        setShowNewNoteModal(true);
                                    }}
                                >
                                    <FilePlus size={16} /> Criar Nova Nota
                                </button>
                            </div>
                          )}
                      </div>
              </div>


              <Modal
                isOpen={showNewNoteModal}
                onClose={() => {
                    setShowNewNoteModal(false);
                    setNewNoteTitle(DEFAULT_NOTE_TITLE);
                }}
                title="Nova Nota"
                footer={
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setShowNewNoteModal(false);
                                setNewNoteTitle(DEFAULT_NOTE_TITLE);
                            }}
                        >
                            Cancelar
                        </button>
                        <button className="btn btn-primary" onClick={handleCreateNote}>
                            Criar
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label>Nome da nota:</label>
                    <input
                        type="text"
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                        placeholder="Digite o nome da nota..."
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleCreateNote();
                            }
                        }}
                    />
                </div>
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
                        <button className="btn btn-primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
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
                        onChange={(e) =>
                            setRenameTarget(renameTarget ? { ...renameTarget, name: e.target.value } : null)
                        }
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
