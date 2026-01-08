import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Presentation,
    Sparkles,
    ChevronLeft,
    Plus,
    Trash2,
    Download,
    FileImage,
    FileText,
    Type,
    Image as ImageIcon,
    Square,
    Circle,
    Minus,
    MousePointer2,
    ZoomIn,
    ZoomOut,
    Undo2,
    Redo2,
    Copy,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Bold,
    Italic,
    Loader2,
    Save,
    Wand2,
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { LocalStorageService } from '../services/localStorage';
import type { ArchivedPresentation } from '../services/localStorage';
import './Presentations.css';

type ViewMode = 'input' | 'editor';
type Tool = 'select' | 'text' | 'image' | 'rectangle' | 'ellipse' | 'line';

interface SlideElement {
    id: string;
    type: 'text' | 'image' | 'rectangle' | 'ellipse' | 'line';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    content?: string;
    src?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: 'left' | 'center' | 'right';
    color?: string;
}

interface Slide {
    id: string;
    elements: SlideElement[];
    background: string;
}

interface PresentationData {
    id: string;
    title: string;
    slides: Slide[];
    createdAt: number;
}

const LANGUAGES = [
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'es-ES', label: 'Español' },
    { value: 'fr-FR', label: 'Français' },
    { value: 'de-DE', label: 'Deutsch' },
];

const IMAGE_STYLES = [
    { value: 'minimal', label: 'Minimalist' },
    { value: 'professional', label: 'Professional' },
    { value: 'creative', label: 'Creative' },
    { value: 'modern', label: 'Modern' },
    { value: 'classic', label: 'Classic' },
];

const WRITING_STYLES = [
    { value: 'formal', label: 'Formal' },
    { value: 'dynamic', label: 'Dynamic' },
    { value: 'casual', label: 'Casual' },
    { value: 'academic', label: 'Academic' },
    { value: 'persuasive', label: 'Persuasive' },
];

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const IMAGE_LAYOUTS = [
    { name: 'right', imageX: 0.52, imageY: 30, imageW: 0.45, imageH: -60, textW: 0.48, textX: 60 },
    { name: 'left', imageX: 0.03, imageY: 30, imageW: 0.45, imageH: -60, textW: 0.48, textX: 0.52 },
    { name: 'bottom', imageX: 0.05, imageY: 0.55, imageW: 0.9, imageH: 0.4, textW: 0.9, textX: 0.05, textY: 40, textH: 0.45 },
    { name: 'top', imageX: 0.05, imageY: 30, imageW: 0.9, imageH: 0.35, textW: 0.9, textX: 0.05, textY: 0.45, textH: 0.5 },
    { name: 'corner-br', imageX: 0.55, imageY: 0.45, imageW: 0.42, imageH: 0.5, textW: 0.9, textX: 60 },
    { name: 'corner-bl', imageX: 0.03, imageY: 0.45, imageW: 0.42, imageH: 0.5, textW: 0.9, textX: 60 },
];

const getLayoutPosition = (layout: typeof IMAGE_LAYOUTS[0], hasImage: boolean) => {
    const calcValue = (val: number, dimension: number) => {
        if (val < 0) return dimension + val;
        if (val <= 1) return val * dimension;
        return val;
    };

    return {
        imageX: calcValue(layout.imageX, SLIDE_WIDTH),
        imageY: calcValue(layout.imageY, SLIDE_HEIGHT),
        imageW: calcValue(layout.imageW, SLIDE_WIDTH),
        imageH: calcValue(layout.imageH, SLIDE_HEIGHT),
        textW: hasImage ? calcValue(layout.textW, SLIDE_WIDTH) : SLIDE_WIDTH - 120,
        textX: typeof layout.textX === 'number' && layout.textX <= 1 ? calcValue(layout.textX, SLIDE_WIDTH) : (layout.textX as number),
        textY: layout.textY ? calcValue(layout.textY, SLIDE_HEIGHT) : 110,
        textH: layout.textH ? calcValue(layout.textH, SLIDE_HEIGHT) : SLIDE_HEIGHT - 150,
    };
};

export function Presentations() {
    const [viewMode, setViewMode] = useState<ViewMode>('input');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isGeneratingImages, setIsGeneratingImages] = useState(false);
    const [generationProgress, setGenerationProgress] = useState('');

    // Input form state
    const [topic, setTopic] = useState('');
    const [language, setLanguage] = useState('pt-BR');
    const [imageStyle, setImageStyle] = useState('professional');
    const [writingStyle, setWritingStyle] = useState('formal');
    const [slideCount, setSlideCount] = useState(5);
    const [stylization, setStylization] = useState(50);

    // Editor state
    const [presentation, setPresentation] = useState<PresentationData | null>(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [selectedTool, setSelectedTool] = useState<Tool>('select');
    const [selectedElements, setSelectedElements] = useState<string[]>([]);
    const [scale, setScale] = useState(1);
    const [history, setHistory] = useState<Slide[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [loadingSlides, setLoadingSlides] = useState<Set<number>>(new Set());

    const canvasRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentSlide = presentation?.slides[currentSlideIndex];

    const addToHistory = useCallback((slides: Slide[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(slides)));
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0 && presentation) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setPresentation({ ...presentation, slides: JSON.parse(JSON.stringify(history[newIndex])) });
        }
    }, [history, historyIndex, presentation]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1 && presentation) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setPresentation({ ...presentation, slides: JSON.parse(JSON.stringify(history[newIndex])) });
        }
    }, [history, historyIndex, presentation]);

    const enhanceUserPrompt = async () => {
        if (!topic.trim()) return;
        
        setIsEnhancing(true);
        try {
            const functions = getFunctions();
            const enhance = httpsCallable(functions, 'enhancePrompt');
            const result = await enhance({ prompt: topic, language });
            const data = result.data as { enhancedPrompt: string };
            setTopic(data.enhancedPrompt);
        } catch (error) {
            console.error('Error enhancing prompt:', error);
        } finally {
            setIsEnhancing(false);
        }
    };

    const buildSlideElements = (
        slideData: { title?: string; subtitle?: string; content?: string; imageUrl?: string },
        index: number,
        presentationTitle: string,
        isLoading: boolean = false
    ): SlideElement[] => {
        const elements: SlideElement[] = [];
        const hasImage = !!slideData.imageUrl;
        const isFirstSlide = index === 0;
        
        const layoutIndex = index % IMAGE_LAYOUTS.length;
        const layout = IMAGE_LAYOUTS[layoutIndex];
        const pos = getLayoutPosition(layout, hasImage);

        if (isFirstSlide) {
            if (hasImage) {
                elements.push({
                    id: generateId(),
                    type: 'text' as const,
                    x: 60,
                    y: SLIDE_HEIGHT / 2 - 80,
                    width: SLIDE_WIDTH * 0.48,
                    height: 100,
                    rotation: 0,
                    content: slideData.title || presentationTitle,
                    fontSize: 48,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 'bold',
                    textAlign: 'left',
                    color: '#ffffff',
                });
                
                if (slideData.subtitle) {
                    elements.push({
                        id: generateId(),
                        type: 'text' as const,
                        x: 60,
                        y: SLIDE_HEIGHT / 2 + 30,
                        width: SLIDE_WIDTH * 0.48,
                        height: 60,
                        rotation: 0,
                        content: slideData.subtitle,
                        fontSize: 22,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 'normal',
                        textAlign: 'left',
                        color: '#a0aec0',
                    });
                }
                
                elements.push({
                    id: generateId(),
                    type: 'image' as const,
                    x: SLIDE_WIDTH * 0.52,
                    y: 30,
                    width: SLIDE_WIDTH * 0.45,
                    height: SLIDE_HEIGHT - 60,
                    rotation: 0,
                    src: slideData.imageUrl,
                });
            } else {
                    elements.push({
                        id: generateId(),
                        type: 'text' as const,
                        x: 60,
                        y: SLIDE_HEIGHT / 2 - 80,
                        width: SLIDE_WIDTH - 120,
                        height: 100,
                        rotation: 0,
                        content: isLoading ? 'Generating...' : (slideData.title || presentationTitle),
                        fontSize: 52,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        color: isLoading ? '#666666' : '#ffffff',
                    });
                
                if (slideData.subtitle) {
                    elements.push({
                        id: generateId(),
                        type: 'text' as const,
                        x: 60,
                        y: SLIDE_HEIGHT / 2 + 30,
                        width: SLIDE_WIDTH - 120,
                        height: 60,
                        rotation: 0,
                        content: slideData.subtitle,
                        fontSize: 24,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 'normal',
                        textAlign: 'center',
                        color: '#a0aec0',
                    });
                }
            }
        } else {
            const titleX = layout.name.includes('left') ? pos.textX : 60;
            
            elements.push({
                id: generateId(),
                type: 'text' as const,
                x: titleX,
                y: 40,
                width: pos.textW,
                height: 60,
                rotation: 0,
                content: isLoading ? 'Generating slide...' : (slideData.title || `Slide ${index + 1}`),
                fontSize: 36,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 'bold',
                textAlign: 'left',
                color: isLoading ? '#666666' : '#ffffff',
            });
            
            if (slideData.content || isLoading) {
                elements.push({
                    id: generateId(),
                    type: 'text' as const,
                    x: titleX,
                    y: pos.textY,
                    width: pos.textW,
                    height: pos.textH,
                    rotation: 0,
                    content: isLoading ? '• Loading content...\n• Please wait for generation' : slideData.content!,
                    fontSize: 20,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 'normal',
                    textAlign: 'left' as const,
                    color: isLoading ? '#555555' : '#e2e8f0',
                });
            }
            
            if (hasImage) {
                elements.push({
                    id: generateId(),
                    type: 'image' as const,
                    x: pos.imageX,
                    y: pos.imageY,
                    width: pos.imageW,
                    height: pos.imageH,
                    rotation: 0,
                    src: slideData.imageUrl,
                });
            }
        }
        
        return elements;
    };

    const generatePresentation = async () => {
        if (!topic.trim()) return;

        setIsGenerating(true);
        setGenerationProgress('Starting generation...');

        try {
            const functions = getFunctions();
            const generateSingleSlide = httpsCallable(functions, 'generateSingleSlide');
            
            const initialSlides: Slide[] = Array.from({ length: slideCount }, (_, i) => ({
                id: generateId(),
                background: '#1a1a2e',
                elements: buildSlideElements({ title: '', content: '' }, i, topic, true),
            }));

            const newPresentation: PresentationData = {
                id: generateId(),
                title: topic,
                slides: initialSlides,
                createdAt: Date.now(),
            };

            setPresentation(newPresentation);
            setCurrentSlideIndex(0);
            setViewMode('editor');
            setLoadingSlides(new Set(Array.from({ length: slideCount }, (_, i) => i)));

            const generatedSlides: { title?: string; subtitle?: string; content?: string; imageUrl?: string; background?: string }[] = [];

            for (let i = 0; i < slideCount; i++) {
                setGenerationProgress(`Generating slide ${i + 1} of ${slideCount}...`);
                
                try {
                    const result = await generateSingleSlide({
                        topic,
                        language,
                        writingStyle,
                        slideIndex: i,
                        totalSlides: slideCount,
                        stylization,
                        imageStyle,
                        previousSlides: generatedSlides.map(s => ({ title: s.title, content: s.content })),
                    });

                    const slideData = result.data as {
                        title: string;
                        subtitle?: string;
                        content?: string;
                        background: string;
                        imageUrl: string;
                    };

                    generatedSlides.push(slideData);

                    setPresentation(prev => {
                        if (!prev) return prev;
                        const updatedSlides = [...prev.slides];
                        updatedSlides[i] = {
                            id: updatedSlides[i].id,
                            background: slideData.background || '#1a1a2e',
                            elements: buildSlideElements(slideData, i, prev.title, false),
                        };
                        return { ...prev, slides: updatedSlides, title: i === 0 ? slideData.title : prev.title };
                    });

                    setLoadingSlides(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(i);
                        return newSet;
                    });

                } catch (slideError) {
                    console.error(`Error generating slide ${i}:`, slideError);
                    setLoadingSlides(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(i);
                        return newSet;
                    });
                }
            }

            setPresentation(prev => {
                if (prev) addToHistory(prev.slides);
                return prev;
            });

        } catch (error) {
            console.error('Error generating presentation:', error);
            const defaultSlides: Slide[] = Array.from({ length: slideCount }, (_, i) => ({
                id: generateId(),
                background: '#1a1a2e',
                elements: [
                    {
                        id: generateId(),
                        type: 'text' as const,
                        x: 60,
                        y: i === 0 ? 200 : 40,
                        width: SLIDE_WIDTH - 120,
                        height: i === 0 ? 80 : 60,
                        rotation: 0,
                        content: i === 0 ? topic : `Slide ${i + 1}`,
                        fontSize: i === 0 ? 48 : 36,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 'bold',
                        textAlign: i === 0 ? 'center' : 'left',
                        color: '#ffffff',
                    },
                ],
            }));

            const newPresentation: PresentationData = {
                id: generateId(),
                title: topic,
                slides: defaultSlides,
                createdAt: Date.now(),
            };

            setPresentation(newPresentation);
            setCurrentSlideIndex(0);
            addToHistory(defaultSlides);
            setViewMode('editor');
        } finally {
            setIsGenerating(false);
            setGenerationProgress('');
            setLoadingSlides(new Set());
        }
    };

    const generateImageForSlide = async (slideIndex: number) => {
        if (!presentation) return;
        
        setIsGeneratingImages(true);
        try {
            const slide = presentation.slides[slideIndex];
            const textContent = slide.elements
                .filter(el => el.type === 'text')
                .map(el => el.content)
                .join(' ');
            
            const functions = getFunctions();
            const generateImgPrompts = httpsCallable(functions, 'generateImagePrompts');
            const imgPromptsResult = await generateImgPrompts({
                slides: [{ title: textContent.substring(0, 100), content: textContent }],
                imageStyle,
                presentationTitle: presentation.title,
            });
            
            const imgPromptsData = imgPromptsResult.data as { imagePrompts: { slideIndex: number; imagePrompt: string }[] };
            const imgPrompt = imgPromptsData.imagePrompts?.[0]?.imagePrompt;
            
            if (imgPrompt) {
                const generateImage = httpsCallable(functions, 'generateSlideImage');
                const imgResult = await generateImage({ prompt: imgPrompt, size: '1024x1024' });
                const imgData = imgResult.data as { imageUrl: string };
                
                const newImageElement: SlideElement = {
                    id: generateId(),
                    type: 'image',
                    x: SLIDE_WIDTH / 2 + 20,
                    y: 40,
                    width: SLIDE_WIDTH / 2 - 80,
                    height: SLIDE_HEIGHT - 80,
                    rotation: 0,
                    src: imgData.imageUrl,
                };
                
                const newSlides = presentation.slides.map((s, idx) => {
                    if (idx === slideIndex) {
                        return { ...s, elements: [...s.elements, newImageElement] };
                    }
                    return s;
                });
                
                setPresentation({ ...presentation, slides: newSlides });
                addToHistory(newSlides);
            }
        } catch (error) {
            console.error('Error generating image for slide:', error);
        } finally {
            setIsGeneratingImages(false);
        }
    };

    const updateSlideElement = useCallback((elementId: string, updates: Partial<SlideElement>) => {
        if (!presentation) return;

        const newSlides = presentation.slides.map((slide, idx) => {
            if (idx === currentSlideIndex) {
                return {
                    ...slide,
                    elements: slide.elements.map(el =>
                        el.id === elementId ? { ...el, ...updates } : el
                    ),
                };
            }
            return slide;
        });

        setPresentation({ ...presentation, slides: newSlides });
    }, [presentation, currentSlideIndex]);

    const addElement = useCallback((type: SlideElement['type']) => {
        if (!presentation) return;

        const newElement: SlideElement = {
            id: generateId(),
            type,
            x: SLIDE_WIDTH / 2 - 100,
            y: SLIDE_HEIGHT / 2 - 50,
            width: type === 'line' ? 200 : 200,
            height: type === 'line' ? 4 : 100,
            rotation: 0,
            content: type === 'text' ? 'New text' : undefined,
            fill: type === 'text' ? 'transparent' : '#3b82f6',
            stroke: '#ffffff',
            strokeWidth: 2,
            fontSize: 24,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'normal',
            textAlign: 'left',
            color: '#ffffff',
        };

        const newSlides = presentation.slides.map((slide, idx) => {
            if (idx === currentSlideIndex) {
                return { ...slide, elements: [...slide.elements, newElement] };
            }
            return slide;
        });

        setPresentation({ ...presentation, slides: newSlides });
        setSelectedElements([newElement.id]);
        addToHistory(newSlides);
    }, [presentation, currentSlideIndex, addToHistory]);

    const deleteSelectedElements = useCallback(() => {
        if (!presentation || selectedElements.length === 0) return;

        const newSlides = presentation.slides.map((slide, idx) => {
            if (idx === currentSlideIndex) {
                return {
                    ...slide,
                    elements: slide.elements.filter(el => !selectedElements.includes(el.id)),
                };
            }
            return slide;
        });

        setPresentation({ ...presentation, slides: newSlides });
        setSelectedElements([]);
        addToHistory(newSlides);
    }, [presentation, currentSlideIndex, selectedElements, addToHistory]);

    const duplicateSelectedElements = useCallback(() => {
        if (!presentation || selectedElements.length === 0) return;

        const newSlides = presentation.slides.map((slide, idx) => {
            if (idx === currentSlideIndex) {
                const newElements = slide.elements
                    .filter(el => selectedElements.includes(el.id))
                    .map(el => ({ ...el, id: generateId(), x: el.x + 20, y: el.y + 20 }));
                return { ...slide, elements: [...slide.elements, ...newElements] };
            }
            return slide;
        });

        setPresentation({ ...presentation, slides: newSlides });
        addToHistory(newSlides);
    }, [presentation, currentSlideIndex, selectedElements, addToHistory]);

    const addSlide = useCallback(() => {
        if (!presentation) return;

        const newSlide: Slide = {
            id: generateId(),
            background: '#1a1a2e',
            elements: [
                {
                    id: generateId(),
                    type: 'text',
                    x: 60,
                    y: 40,
                    width: SLIDE_WIDTH - 120,
                    height: 60,
                    rotation: 0,
                    content: 'New Slide',
                    fontSize: 36,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 'bold',
                    textAlign: 'left',
                    color: '#ffffff',
                },
            ],
        };

        const newSlides = [...presentation.slides, newSlide];
        setPresentation({ ...presentation, slides: newSlides });
        setCurrentSlideIndex(newSlides.length - 1);
        addToHistory(newSlides);
    }, [presentation, addToHistory]);

    const deleteSlide = useCallback((index: number) => {
        if (!presentation || presentation.slides.length <= 1) return;

        const newSlides = presentation.slides.filter((_, idx) => idx !== index);
        setPresentation({ ...presentation, slides: newSlides });
        if (currentSlideIndex >= newSlides.length) {
            setCurrentSlideIndex(newSlides.length - 1);
        }
        addToHistory(newSlides);
    }, [presentation, currentSlideIndex, addToHistory]);

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !presentation) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const newElement: SlideElement = {
                id: generateId(),
                type: 'image',
                x: SLIDE_WIDTH / 2 - 150,
                y: SLIDE_HEIGHT / 2 - 100,
                width: 300,
                height: 200,
                rotation: 0,
                src: event.target?.result as string,
            };

            const newSlides = presentation.slides.map((slide, idx) => {
                if (idx === currentSlideIndex) {
                    return { ...slide, elements: [...slide.elements, newElement] };
                }
                return slide;
            });

            setPresentation({ ...presentation, slides: newSlides });
            setSelectedElements([newElement.id]);
            addToHistory(newSlides);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, [presentation, currentSlideIndex, addToHistory]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        if (!canvasRef.current || !currentSlide || selectedTool !== 'select') return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        const clickedElement = [...currentSlide.elements].reverse().find(el => {
            return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
        });

        if (clickedElement) {
            if (!e.shiftKey) {
                setSelectedElements([clickedElement.id]);
            } else {
                setSelectedElements(prev =>
                    prev.includes(clickedElement.id)
                        ? prev.filter(id => id !== clickedElement.id)
                        : [...prev, clickedElement.id]
                );
            }
            setIsDragging(true);
            setDragStart({ x, y });
        } else {
            setSelectedElements([]);
        }
    }, [currentSlide, selectedTool, scale]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !canvasRef.current || !presentation) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        const dx = x - dragStart.x;
        const dy = y - dragStart.y;

        const newSlides = presentation.slides.map((slide, idx) => {
            if (idx === currentSlideIndex) {
                return {
                    ...slide,
                    elements: slide.elements.map(el =>
                        selectedElements.includes(el.id)
                            ? { ...el, x: el.x + dx, y: el.y + dy }
                            : el
                    ),
                };
            }
            return slide;
        });

        setPresentation({ ...presentation, slides: newSlides });
        setDragStart({ x, y });
    }, [isDragging, presentation, currentSlideIndex, selectedElements, scale, dragStart]);

    const handleCanvasMouseUp = useCallback(() => {
        if (isDragging && presentation) {
            addToHistory(presentation.slides);
        }
        setIsDragging(false);
    }, [isDragging, presentation, addToHistory]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        if (!canvasRef.current || !currentSlide) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        const clickedElement = [...currentSlide.elements].reverse().find(el => {
            return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
        });

        if (clickedElement?.type === 'text') {
            setEditingTextId(clickedElement.id);
        }
    }, [currentSlide, scale]);

    const savePresentation = useCallback(() => {
        if (!presentation) return;

        const archived: ArchivedPresentation = {
            id: presentation.id,
            type: 'presentation',
            title: presentation.title,
            createdAt: presentation.createdAt,
            content: JSON.stringify(presentation),
            slideCount: presentation.slides.length,
        };

        LocalStorageService.saveItem(archived);
    }, [presentation]);

    const exportAsPNG = useCallback(async (slideIndex?: number) => {
        if (!presentation) return;

        const indicesToExport = slideIndex !== undefined ? [slideIndex] : presentation.slides.map((_, i) => i);

        for (const idx of indicesToExport) {
            const slide = presentation.slides[idx];
            const canvas = document.createElement('canvas');
            canvas.width = SLIDE_WIDTH;
            canvas.height = SLIDE_HEIGHT;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            ctx.fillStyle = slide.background;
            ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);

            for (const el of slide.elements) {
                ctx.save();

                if (el.type === 'text') {
                    ctx.font = `${el.fontWeight || 'normal'} ${el.fontStyle || 'normal'} ${el.fontSize || 24}px ${el.fontFamily || 'Inter'}`;
                    ctx.fillStyle = el.color || '#ffffff';
                    ctx.textAlign = el.textAlign || 'left';
                    ctx.textBaseline = 'top';

                    const lines = (el.content || '').split('\n');
                    const lineHeight = (el.fontSize || 24) * 1.2;
                    lines.forEach((line, i) => {
                        let x = el.x;
                        if (el.textAlign === 'center') x = el.x + el.width / 2;
                        else if (el.textAlign === 'right') x = el.x + el.width;
                        ctx.fillText(line, x, el.y + i * lineHeight);
                    });
                } else if (el.type === 'image' && el.src) {
                    const img = new window.Image();
                    img.src = el.src;
                    await new Promise(resolve => { img.onload = resolve; });
                    ctx.drawImage(img, el.x, el.y, el.width, el.height);
                } else if (el.type === 'rectangle') {
                    ctx.fillStyle = el.fill || '#3b82f6';
                    ctx.fillRect(el.x, el.y, el.width, el.height);
                    if (el.stroke) {
                        ctx.strokeStyle = el.stroke;
                        ctx.lineWidth = el.strokeWidth || 2;
                        ctx.strokeRect(el.x, el.y, el.width, el.height);
                    }
                } else if (el.type === 'ellipse') {
                    ctx.fillStyle = el.fill || '#3b82f6';
                    ctx.beginPath();
                    ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    if (el.stroke) {
                        ctx.strokeStyle = el.stroke;
                        ctx.lineWidth = el.strokeWidth || 2;
                        ctx.stroke();
                    }
                } else if (el.type === 'line') {
                    ctx.strokeStyle = el.stroke || '#ffffff';
                    ctx.lineWidth = el.strokeWidth || 2;
                    ctx.beginPath();
                    ctx.moveTo(el.x, el.y + el.height / 2);
                    ctx.lineTo(el.x + el.width, el.y + el.height / 2);
                    ctx.stroke();
                }

                ctx.restore();
            }

            const link = document.createElement('a');
            link.download = `${presentation.title}-slide-${idx + 1}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    }, [presentation]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (editingTextId) return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                duplicateSelectedElements();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteSelectedElements();
            }
            if (e.key === 'Escape') {
                setSelectedElements([]);
                setEditingTextId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingTextId, undo, redo, duplicateSelectedElements, deleteSelectedElements]);

    const selectedElement = currentSlide?.elements.find(el => selectedElements.includes(el.id));

    if (viewMode === 'input') {
        return (
            <div className="presentations-page page-content">
                <div className="presentations-header">
                    <div className="header-icon">
                        <Presentation size={32} />
                    </div>
                    <h1>Create Presentation</h1>
                    <p>Generate professional presentations with artificial intelligence</p>
                </div>

                <div className="presentations-form">
                    <div className="form-group">
                        <label>Presentation Topic</label>
                        <div className="textarea-with-enhance">
                            <textarea
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="Describe your presentation topic..."
                                rows={3}
                            />
                            <button 
                                className="enhance-btn"
                                onClick={enhanceUserPrompt}
                                disabled={!topic.trim() || isEnhancing}
                                title="Enhance prompt with AI"
                            >
                                {isEnhancing ? (
                                    <Loader2 size={18} className="spinning" />
                                ) : (
                                    <Wand2 size={18} />
                                )}
                                Enhance
                            </button>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Language</label>
                            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                                {LANGUAGES.map(lang => (
                                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Visual Style</label>
                            <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}>
                                {IMAGE_STYLES.map(style => (
                                    <option key={style.value} value={style.value}>{style.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Writing Style</label>
                            <select value={writingStyle} onChange={(e) => setWritingStyle(e.target.value)}>
                                {WRITING_STYLES.map(style => (
                                    <option key={style.value} value={style.value}>{style.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Number of Slides</label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={slideCount}
                                onChange={(e) => setSlideCount(Math.min(30, Math.max(1, Number(e.target.value))))}
                                className="slide-count-input"
                            />
                        </div>
                    </div>

                    <div className="form-group stylization-group">
                        <label>
                            <span>Stylization</span>
                            <div className="stylization-input-wrapper">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={stylization}
                                    onChange={(e) => setStylization(Math.min(100, Math.max(0, Number(e.target.value))))}
                                    className="stylization-number"
                                />
                                <span>%</span>
                            </div>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={stylization}
                            onChange={(e) => setStylization(Number(e.target.value))}
                            className="stylization-slider"
                        />
                        <div className="stylization-labels">
                            <span>Simple</span>
                            <span>Detailed</span>
                        </div>
                    </div>

                    <button
                        className="generate-btn"
                        onClick={generatePresentation}
                        disabled={!topic.trim() || isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={20} className="spinning" />
                                {generationProgress || 'Generating...'}
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} />
                                Generate Presentation
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="presentations-editor">
            <div className="editor-toolbar">
                <div className="toolbar-left">
                    <button className="back-btn" onClick={() => setViewMode('input')}>
                        <ChevronLeft size={20} />
                        Back
                    </button>
                    <span className="presentation-title">{presentation?.title}</span>
                </div>

                <div className="toolbar-center">
                    <div className="tool-group">
                        <button
                            className={`tool-btn ${selectedTool === 'select' ? 'active' : ''}`}
                            onClick={() => setSelectedTool('select')}
                            title="Select (V)"
                        >
                            <MousePointer2 size={18} />
                        </button>
                        <button
                            className={`tool-btn ${selectedTool === 'text' ? 'active' : ''}`}
                            onClick={() => { setSelectedTool('text'); addElement('text'); }}
                            title="Text (T)"
                        >
                            <Type size={18} />
                        </button>
                        <button
                            className="tool-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Image"
                        >
                            <ImageIcon size={18} />
                        </button>
                        <button
                            className={`tool-btn ${selectedTool === 'rectangle' ? 'active' : ''}`}
                            onClick={() => { setSelectedTool('rectangle'); addElement('rectangle'); }}
                            title="Rectangle (R)"
                        >
                            <Square size={18} />
                        </button>
                        <button
                            className={`tool-btn ${selectedTool === 'ellipse' ? 'active' : ''}`}
                            onClick={() => { setSelectedTool('ellipse'); addElement('ellipse'); }}
                            title="Ellipse (O)"
                        >
                            <Circle size={18} />
                        </button>
                        <button
                            className={`tool-btn ${selectedTool === 'line' ? 'active' : ''}`}
                            onClick={() => { setSelectedTool('line'); addElement('line'); }}
                            title="Line (L)"
                        >
                            <Minus size={18} />
                        </button>
                    </div>

                    <div className="tool-separator" />

                    <div className="tool-group">
                        <button className="tool-btn" onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)">
                            <Undo2 size={18} />
                        </button>
                        <button className="tool-btn" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)">
                            <Redo2 size={18} />
                        </button>
                    </div>

                    <div className="tool-separator" />

                    <div className="tool-group zoom-controls">
                        <button className="tool-btn" onClick={() => setScale(s => Math.max(0.25, s - 0.1))}>
                            <ZoomOut size={18} />
                        </button>
                        <span className="zoom-label">{Math.round(scale * 100)}%</span>
                        <button className="tool-btn" onClick={() => setScale(s => Math.min(2, s + 0.1))}>
                            <ZoomIn size={18} />
                        </button>
                    </div>
                </div>

                <div className="toolbar-right">
                    <button className="tool-btn" onClick={savePresentation} title="Save">
                        <Save size={18} />
                    </button>
                    <div className="export-dropdown">
                        <button className="export-btn">
                            <Download size={18} />
                            Export
                        </button>
                        <div className="export-menu">
                            <button onClick={() => exportAsPNG(currentSlideIndex)}>
                                <FileImage size={16} />
                                Current slide (PNG)
                            </button>
                            <button onClick={() => exportAsPNG()}>
                                <FileText size={16} />
                                All slides (PNG)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="editor-main">
                <div className="slides-panel">
                    <div className="slides-list">
                        {presentation?.slides.map((slide, idx) => (
                            <div
                                key={slide.id}
                                className={`slide-thumbnail ${idx === currentSlideIndex ? 'active' : ''} ${loadingSlides.has(idx) ? 'loading' : ''}`}
                                onClick={() => setCurrentSlideIndex(idx)}
                            >
                                <span className="slide-number">{idx + 1}</span>
                                <div
                                    className="thumbnail-preview"
                                    style={{ background: slide.background }}
                                >
                                    {loadingSlides.has(idx) ? (
                                        <div className="thumbnail-loading">
                                            <Loader2 size={20} className="spinning" />
                                            <span>Generating...</span>
                                        </div>
                                    ) : (
                                        slide.elements.slice(0, 2).map(el => (
                                            el.type === 'text' && (
                                                <div
                                                    key={el.id}
                                                    className="thumbnail-text"
                                                    style={{
                                                        fontSize: `${(el.fontSize || 24) * 0.08}px`,
                                                        left: `${(el.x / SLIDE_WIDTH) * 100}%`,
                                                        top: `${(el.y / SLIDE_HEIGHT) * 100}%`,
                                                        width: `${(el.width / SLIDE_WIDTH) * 100}%`,
                                                    }}
                                                >
                                                    {el.content?.substring(0, 20)}
                                                </div>
                                            )
                                        ))
                                    )}
                                </div>
                                <div className="slide-actions">
                                    <button
                                        className="generate-img-btn"
                                        onClick={(e) => { e.stopPropagation(); generateImageForSlide(idx); }}
                                        disabled={isGeneratingImages || loadingSlides.has(idx)}
                                        title="Generate image with AI"
                                    >
                                        {isGeneratingImages ? <Loader2 size={12} className="spinning" /> : <ImageIcon size={12} />}
                                    </button>
                                    {presentation.slides.length > 1 && (
                                        <button
                                            className="delete-slide-btn"
                                            onClick={(e) => { e.stopPropagation(); deleteSlide(idx); }}
                                            disabled={loadingSlides.has(idx)}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="add-slide-btn" onClick={addSlide}>
                        <Plus size={20} />
                        New Slide
                    </button>
                </div>

                <div className="canvas-area">
                    <div
                        ref={canvasRef}
                        className="slide-canvas"
                        style={{
                            width: SLIDE_WIDTH * scale,
                            height: SLIDE_HEIGHT * scale,
                            background: currentSlide?.background || '#1a1a2e',
                        }}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onDoubleClick={handleDoubleClick}
                    >
                        {currentSlide?.elements.map(el => (
                            <div
                                key={el.id}
                                className={`canvas-element ${selectedElements.includes(el.id) ? 'selected' : ''}`}
                                style={{
                                    position: 'absolute',
                                    left: el.x * scale,
                                    top: el.y * scale,
                                    width: el.width * scale,
                                    height: el.height * scale,
                                    transform: `rotate(${el.rotation}deg)`,
                                }}
                            >
                                {el.type === 'text' && (
                                    editingTextId === el.id ? (
                                        <textarea
                                            autoFocus
                                            value={el.content || ''}
                                            onChange={(e) => updateSlideElement(el.id, { content: e.target.value })}
                                            onBlur={() => {
                                                setEditingTextId(null);
                                                if (presentation) addToHistory(presentation.slides);
                                            }}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                fontSize: (el.fontSize || 24) * scale,
                                                fontFamily: el.fontFamily,
                                                fontWeight: el.fontWeight,
                                                fontStyle: el.fontStyle,
                                                textAlign: el.textAlign,
                                                color: el.color,
                                                background: 'transparent',
                                                border: 'none',
                                                outline: 'none',
                                                resize: 'none',
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                fontSize: (el.fontSize || 24) * scale,
                                                fontFamily: el.fontFamily,
                                                fontWeight: el.fontWeight,
                                                fontStyle: el.fontStyle,
                                                textAlign: el.textAlign,
                                                color: el.color,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {el.content}
                                        </div>
                                    )
                                )}
                                {el.type === 'image' && el.src && (
                                    <img
                                        src={el.src}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        draggable={false}
                                    />
                                )}
                                {el.type === 'rectangle' && (
                                    <div
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            background: el.fill,
                                            border: el.stroke ? `${el.strokeWidth}px solid ${el.stroke}` : 'none',
                                        }}
                                    />
                                )}
                                {el.type === 'ellipse' && (
                                    <div
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            background: el.fill,
                                            borderRadius: '50%',
                                            border: el.stroke ? `${el.strokeWidth}px solid ${el.stroke}` : 'none',
                                        }}
                                    />
                                )}
                                {el.type === 'line' && (
                                    <div
                                        style={{
                                            width: '100%',
                                            height: el.strokeWidth || 2,
                                            background: el.stroke || '#ffffff',
                                            position: 'absolute',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                        }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {selectedElement && (
                    <div className="properties-panel">
                        <h3>Properties</h3>

                        {selectedElement.type === 'text' && (
                            <>
                                <div className="prop-section">
                                    <label>Text Color</label>
                                    <input
                                        type="color"
                                        value={selectedElement.color || '#ffffff'}
                                        onChange={(e) => updateSlideElement(selectedElement.id, { color: e.target.value })}
                                    />
                                </div>

                                <div className="prop-section">
                                    <label>Size</label>
                                    <input
                                        type="number"
                                        min="12"
                                        max="120"
                                        value={selectedElement.fontSize || 24}
                                        onChange={(e) => updateSlideElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                                    />
                                </div>

                                <div className="prop-section">
                                    <label>Alignment</label>
                                    <div className="align-buttons">
                                        <button
                                            className={selectedElement.textAlign === 'left' ? 'active' : ''}
                                            onClick={() => updateSlideElement(selectedElement.id, { textAlign: 'left' })}
                                        >
                                            <AlignLeft size={16} />
                                        </button>
                                        <button
                                            className={selectedElement.textAlign === 'center' ? 'active' : ''}
                                            onClick={() => updateSlideElement(selectedElement.id, { textAlign: 'center' })}
                                        >
                                            <AlignCenter size={16} />
                                        </button>
                                        <button
                                            className={selectedElement.textAlign === 'right' ? 'active' : ''}
                                            onClick={() => updateSlideElement(selectedElement.id, { textAlign: 'right' })}
                                        >
                                            <AlignRight size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="prop-section">
                                    <label>Style</label>
                                    <div className="style-buttons">
                                        <button
                                            className={selectedElement.fontWeight === 'bold' ? 'active' : ''}
                                            onClick={() => updateSlideElement(selectedElement.id, {
                                                fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold'
                                            })}
                                        >
                                            <Bold size={16} />
                                        </button>
                                        <button
                                            className={selectedElement.fontStyle === 'italic' ? 'active' : ''}
                                            onClick={() => updateSlideElement(selectedElement.id, {
                                                fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic'
                                            })}
                                        >
                                            <Italic size={16} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {(selectedElement.type === 'rectangle' || selectedElement.type === 'ellipse') && (
                            <>
                                <div className="prop-section">
                                    <label>Fill Color</label>
                                    <input
                                        type="color"
                                        value={selectedElement.fill || '#3b82f6'}
                                        onChange={(e) => updateSlideElement(selectedElement.id, { fill: e.target.value })}
                                    />
                                </div>
                                <div className="prop-section">
                                    <label>Border Color</label>
                                    <input
                                        type="color"
                                        value={selectedElement.stroke || '#ffffff'}
                                        onChange={(e) => updateSlideElement(selectedElement.id, { stroke: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        {selectedElement.type === 'line' && (
                            <div className="prop-section">
                                <label>Line Color</label>
                                <input
                                    type="color"
                                    value={selectedElement.stroke || '#ffffff'}
                                    onChange={(e) => updateSlideElement(selectedElement.id, { stroke: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="prop-section">
                            <label>Actions</label>
                            <div className="action-buttons">
                                <button onClick={duplicateSelectedElements} title="Duplicate">
                                    <Copy size={16} />
                                </button>
                                <button onClick={deleteSelectedElements} title="Delete" className="delete-btn">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
            />
        </div>
    );
}

export default Presentations;