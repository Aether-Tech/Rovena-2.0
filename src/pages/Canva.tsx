import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    MousePointer2,
    Hand,
    Square,
    Circle,
    Diamond,
    ArrowRight,
    Minus,
    Type,
    Pencil,
    Zap,
    Eraser,
    Undo2,
    Redo2,
    Trash2,
    ZoomIn,
    ZoomOut,
    Download,
    Copy,
    Lock,
    Unlock,
    Layers,
    ChevronUp,
    ChevronDown,

} from 'lucide-react';
import './Canva.css';

// Types
type Tool = 'select' | 'hand' | 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'line' | 'text' | 'pencil' | 'laser' | 'eraser' | 'image';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null;
type LineHandle = 'start' | 'end' | 'control' | null;
type InteractionMode = 'none' | 'drawing' | 'moving' | 'resizing' | 'rotating' | 'selecting' | 'editingLine';

interface Point {
    x: number;
    y: number;
}

interface CanvasElement {
    id: string;
    type: 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'line' | 'text' | 'pencil' | 'image';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    strokeStyle: 'solid' | 'dashed' | 'dotted';
    roughness: number;
    borderRadius: number;
    opacity: number;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    points?: Point[];
    controlPoint?: Point; // For lines/arrows mid-point
    lineStyle: 'straight' | 'elbow' | 'curve'; // Type of line connection
    arrowStart: 'none' | 'arrow' | 'dot'; // Start endpoint style
    arrowEnd: 'none' | 'arrow' | 'dot'; // End endpoint style
    startConnection?: string;
    endConnection?: string;
    locked: boolean;
    selected: boolean;
}

interface ToolButton {
    id: Tool;
    icon: React.ElementType;
    label: string;
    shortcut: string;
}

const mainTools: ToolButton[] = [
    { id: 'select', icon: MousePointer2, label: 'Selecionar', shortcut: 'V' },
    { id: 'hand', icon: Hand, label: 'Mover canvas', shortcut: 'H' },
    { id: 'rectangle', icon: Square, label: 'Retângulo', shortcut: 'R' },
    { id: 'ellipse', icon: Circle, label: 'Elipse', shortcut: 'O' },
    { id: 'diamond', icon: Diamond, label: 'Diamante', shortcut: 'D' },
    { id: 'arrow', icon: ArrowRight, label: 'Seta', shortcut: 'A' },
    { id: 'line', icon: Minus, label: 'Linha', shortcut: 'L' },
    { id: 'text', icon: Type, label: 'Texto', shortcut: 'T' },
];

const drawingTools: ToolButton[] = [
    { id: 'pencil', icon: Pencil, label: 'Lápis', shortcut: 'P' },
    { id: 'laser', icon: Zap, label: 'Laser', shortcut: 'K' },
    { id: 'eraser', icon: Eraser, label: 'Borracha', shortcut: 'E' },
];

const colors = [
    '#000000', '#343a40', '#495057', '#ffffff',
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
];

const strokeWidths = [1, 2, 4, 8];

// Selection color - green
const SELECTION_COLOR = '#22c55e';

export function Canva() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Canvas state
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [selectedTool, setSelectedTool] = useState<Tool>('select');
    const [selectedElements, setSelectedElements] = useState<string[]>([]);
    const [cursorStyle, setCursorStyle] = useState<string>('default');
    const [hoveredLock, setHoveredLock] = useState<string | null>(null);

    // Default styles for new elements
    const [defaultStyles, setDefaultStyles] = useState<{
        stroke: string;
        fill: string;
        strokeWidth: number;
        opacity: number;
        strokeStyle: CanvasElement['strokeStyle'];
        roughness: number;
        borderRadius: number;
    }>({
        stroke: '#ffffff',
        fill: 'transparent',
        strokeWidth: 2,
        opacity: 1,
        strokeStyle: 'solid',
        roughness: 1,
        borderRadius: 0
    });

    // View state
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);

    // Interaction state
    const [interactionMode, setInteractionMode] = useState<InteractionMode>('none');
    const [isPanning, setIsPanning] = useState(false);
    const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
    const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null);

    // Resize/Rotate state
    const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
    const [isRotating, setIsRotating] = useState(false);
    const [initialElementState, setInitialElementState] = useState<CanvasElement | null>(null);

    // Line/Arrow editing state
    const [activeLineHandle, setActiveLineHandle] = useState<LineHandle>(null);

    // Selection box state
    const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);

    // History
    const [history, setHistory] = useState<CanvasElement[][]>([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // Clipboard
    const [clipboard, setClipboard] = useState<CanvasElement[]>([]);

    // Text editing
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);

    // Laser pointer state
    interface LaserPoint {
        x: number;
        y: number;
        timestamp: number;
    }
    interface LaserStroke {
        points: LaserPoint[];
        id: string;
        finishedAt?: number; // Timestamp when user released mouse
    }
    const [laserStrokes, setLaserStrokes] = useState<LaserStroke[]>([]);
    const [currentLaserStroke, setCurrentLaserStroke] = useState<LaserStroke | null>(null);

    // Eraser state
    const [eraserPath, setEraserPath] = useState<{ x: number, y: number, timestamp: number }[] | null>(null);
    const [erasedIds, setErasedIds] = useState<Set<string>>(new Set());
    const lastEraserPosRef = useRef<Point | null>(null);

    // Get the first selected element for the floating panel
    const selectedElement = elements.find(el => selectedElements.includes(el.id));

    // Generate unique ID
    const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get canvas coordinates from mouse event
    const getCanvasCoords = useCallback((e: React.MouseEvent | MouseEvent): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - offset.x) / scale,
            y: (e.clientY - rect.top - offset.y) / scale
        };
    }, [offset, scale]);

    // Helper: Check if point is inside element
    const isPointInElement = useCallback((point: Point, el: CanvasElement, tolerance: number = 0): boolean => {
        const cos = Math.cos(-el.rotation);
        const sin = Math.sin(-el.rotation);
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        const dx = point.x - cx;
        const dy = point.y - cy;
        const localX = dx * cos - dy * sin + el.width / 2;
        const localY = dx * sin + dy * cos + el.height / 2;

        return localX >= -tolerance && localX <= el.width + tolerance && localY >= -tolerance && localY <= el.height + tolerance;
    }, []);

    // Helper: Calculate text height with wrapping
    const calculateTextHeight = useCallback((ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number, fontFamily: string): number => {
        ctx.font = `${fontSize}px ${fontFamily}`;
        const lineHeight = fontSize * 1.2;


        // If no text, return min height
        if (!text) return lineHeight;

        // Handle manual newlines first
        const paragraphs = text.split('\n');
        let totalHeight = 0;

        paragraphs.forEach((paragraph) => {
            const words = paragraph.split(' ');
            let line = '';
            let linesInParagraph = 1;

            if (paragraph === '') {
                // Empty line
                linesInParagraph = 1;
            } else {
                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    const metrics = ctx.measureText(testLine);
                    const testWidth = metrics.width;

                    if (testWidth > maxWidth && n > 0) {
                        line = words[n] + ' ';
                        linesInParagraph++;
                    } else {
                        line = testLine;
                    }
                }
            }
            totalHeight += linesInParagraph * lineHeight;
        });

        return Math.max(totalHeight, lineHeight);
    }, []);

    // Helper: Wrap text into lines for drawing
    const getWrappedTextLines = useCallback((ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {

        const lines: string[] = [];
        const paragraphs = text.split('\n');

        paragraphs.forEach(paragraph => {
            if (paragraph === '') {
                lines.push('');
                return;
            }

            const words = paragraph.split(' ');
            let line = '';

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);
        });

        return lines;
    }, []);

    // Laser pointer functions
    const addLaserPoint = useCallback((point: Point) => {
        const laserPoint = { x: point.x, y: point.y, timestamp: Date.now() };
        if (currentLaserStroke) {
            setCurrentLaserStroke({
                ...currentLaserStroke,
                points: [...currentLaserStroke.points, laserPoint]
            });
        } else {
            setCurrentLaserStroke({
                id: `laser_${Date.now()}`,
                points: [laserPoint]
            });
        }
    }, [currentLaserStroke]);

    const finishLaserStroke = useCallback(() => {
        if (currentLaserStroke && currentLaserStroke.points.length > 0) {
            const finishedStroke = { ...currentLaserStroke, finishedAt: Date.now() };
            setLaserStrokes(prev => [...prev, finishedStroke]);
            setCurrentLaserStroke(null);

            // Remove stroke after all points have faded (1 second point lifetime)
            setTimeout(() => {
                setLaserStrokes(prev => prev.filter(s => s.id !== finishedStroke.id));
            }, 1000);
        }
    }, [currentLaserStroke]);

    // Check if point is on a resize handle
    const getResizeHandle = useCallback((point: Point, element: CanvasElement): ResizeHandle => {
        const handleSize = 10 / scale;
        const cos = Math.cos(element.rotation);
        const sin = Math.sin(element.rotation);
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;

        // Transform point to element's local coordinates
        const dx = point.x - cx;
        const dy = point.y - cy;
        const localX = dx * cos + dy * sin + element.width / 2;
        const localY = -dx * sin + dy * cos + element.height / 2;

        const handles: { handle: ResizeHandle; x: number; y: number }[] = [
            { handle: 'nw', x: 0, y: 0 },
            { handle: 'ne', x: element.width, y: 0 },
            { handle: 'sw', x: 0, y: element.height },
            { handle: 'se', x: element.width, y: element.height },
        ];

        for (const h of handles) {
            if (Math.abs(localX - h.x) < handleSize && Math.abs(localY - h.y) < handleSize) {
                return h.handle;
            }
        }
        return null;
    }, [scale]);

    // Check if point is on rotation handle
    const isOnRotationHandle = useCallback((point: Point, element: CanvasElement): boolean => {
        const handleRadius = 8 / scale;
        const rotationHandleDistance = 30 / scale;

        const cos = Math.cos(element.rotation);
        const sin = Math.sin(element.rotation);
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;

        // Rotation handle position (above the element)
        const rotHandleX = cx - sin * (element.height / 2 + rotationHandleDistance);
        const rotHandleY = cy - cos * (element.height / 2 + rotationHandleDistance);

        const dist = Math.sqrt(Math.pow(point.x - rotHandleX, 2) + Math.pow(point.y - rotHandleY, 2));
        return dist < handleRadius;
    }, [scale]);

    // Check if point is on a line/arrow handle
    const getLineHandle = useCallback((point: Point, element: CanvasElement): LineHandle => {
        if (element.type !== 'line' && element.type !== 'arrow') return null;

        const handleRadius = 10 / scale;

        // Start point
        const startDist = Math.sqrt(Math.pow(point.x - element.x, 2) + Math.pow(point.y - element.y, 2));
        if (startDist < handleRadius) return 'start';

        // End point
        const endX = element.x + element.width;
        const endY = element.y + element.height;
        const endDist = Math.sqrt(Math.pow(point.x - endX, 2) + Math.pow(point.y - endY, 2));
        if (endDist < handleRadius) return 'end';

        // Control point (middle or custom position)
        const controlX = element.controlPoint?.x ?? (element.x + element.width / 2);
        const controlY = element.controlPoint?.y ?? (element.y + element.height / 2);
        const controlDist = Math.sqrt(Math.pow(point.x - controlX, 2) + Math.pow(point.y - controlY, 2));
        if (controlDist < handleRadius) return 'control';

        return null;
    }, [scale]);

    // Find snap point to nearby shapes
    // exactPoints: if true, snap only to corners and centers (Alt held)
    // if false (default), snap to entire edge
    const getSnapPoint = useCallback((point: Point, excludeId: string, exactPoints: boolean = false): { point: Point; elementId: string } | null => {
        const snapDistance = 20 / scale;

        for (const el of elements) {
            if (el.id === excludeId || el.type === 'line' || el.type === 'arrow' || el.type === 'pencil') continue;

            if (exactPoints) {
                // Alt held: snap only to exact points (corners and edge centers)
                const snapPoints = [
                    { x: el.x, y: el.y },
                    { x: el.x + el.width, y: el.y },
                    { x: el.x, y: el.y + el.height },
                    { x: el.x + el.width, y: el.y + el.height },
                    { x: el.x + el.width / 2, y: el.y },
                    { x: el.x + el.width / 2, y: el.y + el.height },
                    { x: el.x, y: el.y + el.height / 2 },
                    { x: el.x + el.width, y: el.y + el.height / 2 },
                ];

                for (const snapPoint of snapPoints) {
                    const dist = Math.sqrt(Math.pow(point.x - snapPoint.x, 2) + Math.pow(point.y - snapPoint.y, 2));
                    if (dist < snapDistance) {
                        return { point: snapPoint, elementId: el.id };
                    }
                }
            } else {
                // Default: snap to nearest point on edge
                let nearestPoint: Point | null = null;
                let nearestDist = snapDistance;

                // Check each edge
                const edges = [
                    { x1: el.x, y1: el.y, x2: el.x + el.width, y2: el.y }, // top
                    { x1: el.x + el.width, y1: el.y, x2: el.x + el.width, y2: el.y + el.height }, // right
                    { x1: el.x, y1: el.y + el.height, x2: el.x + el.width, y2: el.y + el.height }, // bottom
                    { x1: el.x, y1: el.y, x2: el.x, y2: el.y + el.height }, // left
                ];

                for (const edge of edges) {
                    // Find closest point on edge
                    const dx = edge.x2 - edge.x1;
                    const dy = edge.y2 - edge.y1;
                    const t = Math.max(0, Math.min(1, ((point.x - edge.x1) * dx + (point.y - edge.y1) * dy) / (dx * dx + dy * dy)));
                    const closestX = edge.x1 + t * dx;
                    const closestY = edge.y1 + t * dy;
                    const dist = Math.sqrt(Math.pow(point.x - closestX, 2) + Math.pow(point.y - closestY, 2));

                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestPoint = { x: closestX, y: closestY };
                    }
                }

                if (nearestPoint) {
                    return { point: nearestPoint, elementId: el.id };
                }
            }
        }

        return null;
    }, [elements, scale]);

    // Add to history
    const addToHistory = useCallback((newElements: CanvasElement[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push([...newElements]);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    // Undo
    const undo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setElements([...history[historyIndex - 1]]);
            setSelectedElements([]);
        }
    }, [history, historyIndex]);

    // Redo
    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setElements([...history[historyIndex + 1]]);
            setSelectedElements([]);
        }
    }, [history, historyIndex]);

    // Copy selected elements
    const copySelected = useCallback(() => {
        const selected = elements.filter(el => selectedElements.includes(el.id));
        setClipboard(selected.map(el => ({ ...el })));
    }, [elements, selectedElements]);

    // Paste elements
    const paste = useCallback(() => {
        if (clipboard.length === 0) return;

        const newElements = clipboard.map(el => ({
            ...el,
            id: generateId(),
            x: el.x + 20,
            y: el.y + 20,
            selected: true
        }));

        const updatedElements = elements.map(el => ({ ...el, selected: false }));
        const finalElements = [...updatedElements, ...newElements];

        setElements(finalElements);
        setSelectedElements(newElements.map(el => el.id));
        addToHistory(finalElements);
    }, [clipboard, elements, addToHistory]);

    // Delete selected elements
    const deleteSelected = useCallback(() => {
        const newElements = elements.filter(el => !selectedElements.includes(el.id) || el.locked);
        setElements(newElements);
        setSelectedElements([]);
        addToHistory(newElements);
    }, [elements, selectedElements, addToHistory]);

    // Duplicate elements (Alt + drag)
    const duplicateElements = useCallback((ids: string[]) => {
        const toDuplicate = elements.filter(el => ids.includes(el.id));
        const newElements = toDuplicate.map(el => ({
            ...el,
            id: generateId(),
            x: el.x + 10,
            y: el.y + 10
        }));
        return newElements;
    }, [elements]);

    // Update selected element properties
    const updateSelectedElement = useCallback((updates: Partial<CanvasElement>) => {
        const newElements = elements.map(el => {
            if (selectedElements.includes(el.id)) {
                return { ...el, ...updates };
            }
            return el;
        });
        setElements(newElements);
        addToHistory(newElements);
    }, [elements, selectedElements, addToHistory]);

    // Move element in layer order
    const moveElementLayer = useCallback((direction: 'up' | 'down' | 'top' | 'bottom') => {
        if (selectedElements.length === 0) return;

        const newElements = [...elements];
        const selectedIdx = newElements.findIndex(el => selectedElements.includes(el.id));
        if (selectedIdx === -1) return;

        const element = newElements[selectedIdx];
        newElements.splice(selectedIdx, 1);

        switch (direction) {
            case 'up':
                newElements.splice(Math.min(selectedIdx + 1, newElements.length), 0, element);
                break;
            case 'down':
                newElements.splice(Math.max(selectedIdx - 1, 0), 0, element);
                break;
            case 'top':
                newElements.push(element);
                break;
            case 'bottom':
                newElements.unshift(element);
                break;
        }

        setElements(newElements);
        addToHistory(newElements);
    }, [elements, selectedElements, addToHistory]);

    // Draw element on canvas
    const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: CanvasElement) => {
        ctx.save();

        // Apply rotation
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(element.rotation);
        ctx.translate(-cx, -cy);

        ctx.globalAlpha = element.opacity;
        ctx.strokeStyle = element.stroke;
        ctx.fillStyle = element.fill;
        ctx.lineWidth = element.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Apply stroke style
        switch (element.strokeStyle) {
            case 'dashed':
                ctx.setLineDash([12, 6]);
                break;
            case 'dotted':
                ctx.setLineDash([3, 3]);
                break;
            default:
                ctx.setLineDash([]);
        }

        const x = element.x;
        const y = element.y;
        const w = element.width;
        const h = element.height;
        const radius = element.borderRadius * Math.min(Math.abs(w), Math.abs(h)) * 0.2;

        switch (element.type) {
            case 'rectangle':
                if (radius > 0) {
                    // Rounded rectangle
                    ctx.beginPath();
                    ctx.moveTo(x + radius, y);
                    ctx.lineTo(x + w - radius, y);
                    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
                    ctx.lineTo(x + w, y + h - radius);
                    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
                    ctx.lineTo(x + radius, y + h);
                    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
                    ctx.lineTo(x, y + radius);
                    ctx.quadraticCurveTo(x, y, x + radius, y);
                    ctx.closePath();
                    if (element.fill !== 'transparent') {
                        ctx.fill();
                    }
                    ctx.stroke();
                } else {
                    // Sharp rectangle
                    if (element.fill !== 'transparent') {
                        ctx.fillRect(x, y, w, h);
                    }
                    ctx.strokeRect(x, y, w, h);
                }
                if (element.text) {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = element.stroke; // Use stroke color for text
                    ctx.font = `${element.fontSize || 20}px ${element.fontFamily || 'Inter, sans-serif'}`;
                    ctx.fillText(element.text || '', x + w / 2, y + h / 2);
                }
                break;

            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
                if (element.fill !== 'transparent') {
                    ctx.fill();
                }
                ctx.stroke();
                if (element.text) {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = element.stroke;
                    ctx.font = `${element.fontSize || 20}px ${element.fontFamily || 'Inter, sans-serif'}`;
                    ctx.fillText(element.text || '', x + w / 2, y + h / 2);
                }
                break;

            case 'diamond':
                ctx.beginPath();
                ctx.moveTo(x + w / 2, y);
                ctx.lineTo(x + w, y + h / 2);
                ctx.lineTo(x + w / 2, y + h);
                ctx.lineTo(x, y + h / 2);
                ctx.closePath();
                if (element.fill !== 'transparent') {
                    ctx.fill();
                }
                ctx.stroke();
                if (element.text) {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = element.stroke;
                    ctx.font = `${element.fontSize || 20}px ${element.fontFamily || 'Inter, sans-serif'}`;
                    ctx.fillText(element.text || '', x + w / 2, y + h / 2);
                }
                break;

            case 'arrow':
            case 'line':
                const startX = x;
                const startY = y;
                const endX = x + w;
                const endY = y + h;
                const controlX = element.controlPoint?.x ?? (startX + w / 2);
                const controlY = element.controlPoint?.y ?? (startY + h / 2);

                ctx.beginPath();
                ctx.moveTo(startX, startY);

                if (element.lineStyle === 'curve' && element.controlPoint) {
                    // Quadratic bezier curve
                    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
                } else if (element.lineStyle === 'elbow' || element.controlPoint) {
                    // Elbow: two straight lines through control point
                    ctx.lineTo(controlX, controlY);
                    ctx.lineTo(endX, endY);
                } else {
                    // Straight line
                    ctx.lineTo(endX, endY);
                }
                ctx.stroke();

                // Draw start endpoint
                const headLength = 15;
                if (element.arrowStart === 'arrow') {
                    let startAngle: number;
                    if (element.lineStyle === 'elbow' || element.controlPoint) {
                        startAngle = Math.atan2(controlY - startY, controlX - startX);
                    } else {
                        startAngle = Math.atan2(h, w);
                    }
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(
                        startX + headLength * Math.cos(startAngle - Math.PI / 6),
                        startY + headLength * Math.sin(startAngle - Math.PI / 6)
                    );
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(
                        startX + headLength * Math.cos(startAngle + Math.PI / 6),
                        startY + headLength * Math.sin(startAngle + Math.PI / 6)
                    );
                    ctx.stroke();
                } else if (element.arrowStart === 'dot') {
                    ctx.beginPath();
                    ctx.arc(startX, startY, 5, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Draw end endpoint
                if (element.arrowEnd === 'arrow') {
                    let endAngle: number;
                    if (element.lineStyle === 'curve' && element.controlPoint) {
                        endAngle = Math.atan2(endY - controlY, endX - controlX);
                    } else if (element.lineStyle === 'elbow' || element.controlPoint) {
                        endAngle = Math.atan2(endY - controlY, endX - controlX);
                    } else {
                        endAngle = Math.atan2(h, w);
                    }
                    ctx.beginPath();
                    ctx.moveTo(endX, endY);
                    ctx.lineTo(
                        endX - headLength * Math.cos(endAngle - Math.PI / 6),
                        endY - headLength * Math.sin(endAngle - Math.PI / 6)
                    );
                    ctx.moveTo(endX, endY);
                    ctx.lineTo(
                        endX - headLength * Math.cos(endAngle + Math.PI / 6),
                        endY - headLength * Math.sin(endAngle + Math.PI / 6)
                    );
                    ctx.stroke();
                } else if (element.arrowEnd === 'dot') {
                    ctx.beginPath();
                    ctx.arc(endX, endY, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'text':
                ctx.font = `${element.fontSize || 20}px ${element.fontFamily || 'Inter, sans-serif'}`;
                ctx.fillStyle = element.stroke;
                ctx.textBaseline = 'top'; // Easier for multiline

                const lines = getWrappedTextLines(ctx, element.text || 'Texto', w);
                const lineHeight = (element.fontSize || 20) * 1.2;

                lines.forEach((line, i) => {
                    ctx.fillText(line, x, y + i * lineHeight);
                });
                break;

            case 'pencil':
                if (element.points && element.points.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(element.points[0].x, element.points[0].y);
                    for (let i = 1; i < element.points.length; i++) {
                        ctx.lineTo(element.points[i].x, element.points[i].y);
                    }
                    ctx.stroke();
                }
                break;
        }

        // Draw selection handles
        // Only draw individual handles if it's the ONLY selected element
        // If multiple are selected, we draw a group box in render() instead
        const isMultiSelection = selectedElements.length > 1;

        if ((element.selected && !element.locked && !isMultiSelection) || (element.selected && element.locked && !isMultiSelection)) {
            // Show selection for locked elements too, but maybe different style?
            // User said "mostrar do mesmo jeito". But we need to make sure we don't draw resize handles if locked?
            // Actually, usually locked elements just show the bounding box but no handles. 
            // But the user said "mostrar do mesmo jeito" (show the same way).
            // However, "locked" implies no modification. If we show handles, user might try to drag them.
            // Let's typically show just the box for locked, or maybe dashed box.
            // But user asked "é pra mostrar do mesmo jeito" (show exactly the same way). 
            // I'll stick to showing it, but the interaction logic prevents moving/resizing.
            // BUT wait, line 662 has `if (element.selected && !element.locked)`. This explicitly HIDES it if locked.
            // I need to change this condition.
        }

        if (element.selected) {
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = SELECTION_COLOR;
            ctx.lineWidth = 2;

            // Special handles for lines and arrows
            if (element.type === 'line' || element.type === 'arrow') {
                const handleRadius = 6;

                // Start point handle (hollow circle for linking)
                ctx.beginPath();
                ctx.arc(x, y, handleRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // End point handle (hollow circle for linking)
                ctx.beginPath();
                ctx.arc(x + w, y + h, handleRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Control point handle (for bezier curve)
                const ctrlX = element.controlPoint?.x ?? (x + w / 2);
                const ctrlY = element.controlPoint?.y ?? (y + h / 2);

                // Draw line from curve to control point
                ctx.beginPath();
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
                ctx.moveTo(x, y);
                ctx.lineTo(ctrlX, ctrlY);
                ctx.lineTo(x + w, y + h);
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw control point circle
                ctx.beginPath();
                ctx.arc(ctrlX, ctrlY, 5, 0, Math.PI * 2);
                ctx.fillStyle = SELECTION_COLOR;
                ctx.strokeStyle = SELECTION_COLOR;
                ctx.fill();
                ctx.stroke();
            } else {
                // Regular selection box for other shapes
                ctx.strokeStyle = SELECTION_COLOR;
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
                ctx.setLineDash([]);

                const handleSize = 10;
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = SELECTION_COLOR;

                const handles = [
                    { x: x - handleSize / 2, y: y - handleSize / 2 },
                    { x: x + w - handleSize / 2, y: y - handleSize / 2 },
                    { x: x - handleSize / 2, y: y + h - handleSize / 2 },
                    { x: x + w - handleSize / 2, y: y + h - handleSize / 2 },
                ];

                handles.forEach(handle => {
                    ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
                    ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
                });

                // Rotation handle - circle above the element
                const rotationHandleY = y - 30;
                ctx.beginPath();
                ctx.arc(x + w / 2, rotationHandleY, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Line connecting to rotation handle
                ctx.beginPath();
                ctx.setLineDash([3, 3]);
                ctx.moveTo(x + w / 2, y - 4);
                ctx.lineTo(x + w / 2, rotationHandleY + 6);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        if (element.locked) {
            // Draw Lock Icon (Lucide style)
            const lockX = x + 2;
            const lockY = y - 22;

            ctx.save();
            ctx.translate(lockX, lockY);

            // Hover effect
            if (element.id === hoveredLock) {
                ctx.fillStyle = 'rgba(74, 222, 128, 0.2)'; // Green background bg
                ctx.beginPath();
                ctx.arc(8, 8, 14, 0, Math.PI * 2);
                ctx.fill();
            }

            // Lock Body
            ctx.fillStyle = element.id === hoveredLock ? '#4ade80' : '#ef4444'; // Green on hover, Red default
            ctx.strokeStyle = element.id === hoveredLock ? '#4ade80' : '#ef4444';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Shackle
            ctx.beginPath();
            ctx.arc(8, 6, 5, Math.PI, 0); // Top arch
            ctx.lineTo(13, 10);
            ctx.lineTo(3, 10);
            ctx.lineTo(3, 6);
            ctx.stroke();

            // Body Rect
            ctx.beginPath();
            ctx.rect(3, 9, 10, 8);
            ctx.stroke();

            // Keyhole
            ctx.beginPath();
            ctx.moveTo(8, 12);
            ctx.lineTo(8, 14);
            ctx.stroke();

            ctx.restore();
        }

        ctx.restore();
    }, []);

    // Render canvas
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Grid
        const gridSize = 20;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;

        const startX = Math.floor(-offset.x / scale / gridSize) * gridSize;
        const startY = Math.floor(-offset.y / scale / gridSize) * gridSize;
        const endX = startX + canvas.width / scale + gridSize;
        const endY = startY + canvas.height / scale + gridSize;

        for (let x = startX; x < endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
        for (let y = startY; y < endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }

        elements.forEach(element => {
            if (erasedIds.has(element.id)) {
                // Show as 50% opacity when marked for erasure
                drawElement(ctx, { ...element, opacity: element.opacity * 0.5 });
            } else {
                drawElement(ctx, element);
            }
        });

        if (currentElement) {
            drawElement(ctx, currentElement);
        }

        // Draw group selection box (if multiple elements selected)
        if (selectedElements.length > 1) {
            const selectedEls = elements.filter(el => selectedElements.includes(el.id));
            if (selectedEls.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                selectedEls.forEach(el => {
                    minX = Math.min(minX, el.x);
                    minY = Math.min(minY, el.y);
                    maxX = Math.max(maxX, el.x + el.width);
                    maxY = Math.max(maxY, el.y + el.height);
                });

                const padding = 4;
                ctx.strokeStyle = SELECTION_COLOR; // Green solid
                ctx.lineWidth = 1;
                ctx.setLineDash([]); // Solid
                ctx.strokeRect(minX - padding, minY - padding, (maxX - minX) + padding * 2, (maxY - minY) + padding * 2);

                // Draw corners for the group box (visual only for now)
                const handleSize = 8;
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = SELECTION_COLOR;

                const corners = [
                    { x: minX - padding, y: minY - padding },
                    { x: maxX + padding, y: minY - padding },
                    { x: minX - padding, y: maxY + padding },
                    { x: maxX + padding, y: maxY + padding }
                ];

                corners.forEach(Corner => {
                    ctx.fillRect(Corner.x - handleSize / 2, Corner.y - handleSize / 2, handleSize, handleSize);
                    ctx.strokeRect(Corner.x - handleSize / 2, Corner.y - handleSize / 2, handleSize, handleSize);
                });
            }
        }

        // Draw selection box
        if (selectionBox) {
            ctx.strokeStyle = SELECTION_COLOR;
            ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            const boxX = Math.min(selectionBox.start.x, selectionBox.end.x);
            const boxY = Math.min(selectionBox.start.y, selectionBox.end.y);
            const boxW = Math.abs(selectionBox.end.x - selectionBox.start.x);
            const boxH = Math.abs(selectionBox.end.y - selectionBox.start.y);
            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.strokeRect(boxX, boxY, boxW, boxH);
            ctx.setLineDash([]);
        }

        // Draw laser strokes - Excalidraw style (points fade based on their individual age)
        const now = Date.now();
        const pointLifetime = 1000; // Each point lives for 1 second
        const allLaserStrokes = currentLaserStroke ? [...laserStrokes, currentLaserStroke] : laserStrokes;

        allLaserStrokes.forEach(stroke => {
            if (stroke.points.length < 2) return;

            // Filter out points that are too old
            const visiblePoints = stroke.points.filter(p => now - p.timestamp < pointLifetime);

            if (visiblePoints.length < 2) return;

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(255, 0, 0, 1)';
            ctx.shadowBlur = 12;

            // Draw segments with varying width and opacity based on point age
            for (let i = 1; i < visiblePoints.length; i++) {
                const point = visiblePoints[i];
                const pointAge = now - point.timestamp;
                const ageProgress = pointAge / pointLifetime; // 0 = new, 1 = about to disappear

                // Points get thinner and more transparent as they age
                const lineWidth = Math.max(1, 5 * (1 - ageProgress)); // 5px when new, 1px when old
                const opacity = Math.max(0.1, 1 - ageProgress); // 100% when new, fades to 10%

                ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
                ctx.lineWidth = lineWidth;

                ctx.beginPath();
                ctx.moveTo(visiblePoints[i - 1].x, visiblePoints[i - 1].y);
                ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
                ctx.stroke();
            }

            ctx.shadowBlur = 0;
        });

        // Draw Eraser Trail
        if (eraserPath && eraserPath.length > 1) {
            const now = Date.now();
            const maxAge = 250;
            const visibleEraserPoints = eraserPath.filter(p => now - p.timestamp < maxAge);

            if (visibleEraserPoints.length > 1) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowColor = 'rgba(190, 190, 190, 0.7)';
                ctx.shadowBlur = 10;

                for (let i = 1; i < visibleEraserPoints.length; i++) {
                    const age = now - visibleEraserPoints[i].timestamp;
                    const progress = age / maxAge;

                    // Fade out opacity from 0.8 to 0.1
                    const opacity = Math.max(0.1, 0.8 * (1 - progress));

                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(185, 185, 185, ${opacity})`;

                    // Width tapers from 10 to 2
                    ctx.lineWidth = Math.max(2, 10 * (1 - progress));

                    ctx.moveTo(visibleEraserPoints[i - 1].x, visibleEraserPoints[i - 1].y);
                    ctx.lineTo(visibleEraserPoints[i].x, visibleEraserPoints[i].y);
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;
            }
        }

        ctx.restore();
    }, [elements, currentElement, offset, scale, drawElement, selectionBox, laserStrokes, currentLaserStroke, hoveredLock, eraserPath, erasedIds, selectedElements]);

    // Mouse down handler

    // Mouse down handler
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const point = getCanvasCoords(e);
        setStartPoint(point);

        if (selectedTool === 'hand' || e.button === 1) {
            setIsPanning(true);
            return;
        }

        if (e.button === 0) {
            if (selectedTool === 'select') {
                // Check if clicking on rotation handle of selected element
                const selectedEl = elements.find(el => selectedElements.includes(el.id));

                // Check if clicking on line/arrow handles
                if (selectedEl && !selectedEl.locked && (selectedEl.type === 'line' || selectedEl.type === 'arrow')) {
                    const lineHandle = getLineHandle(point, selectedEl);
                    if (lineHandle) {
                        setActiveLineHandle(lineHandle);
                        setInteractionMode('editingLine');
                        setInitialElementState({ ...selectedEl });
                        return;
                    }
                }

                if (selectedEl && !selectedEl.locked && isOnRotationHandle(point, selectedEl)) {
                    setIsRotating(true);
                    setInteractionMode('rotating');
                    setInitialElementState({ ...selectedEl });
                    return;
                }

                // Check if clicking on resize handle
                if (selectedEl && !selectedEl.locked) {
                    const handle = getResizeHandle(point, selectedEl);
                    if (handle) {
                        setActiveHandle(handle);
                        setInteractionMode('resizing');
                        setInitialElementState({ ...selectedEl });
                        return;
                    }
                }

                // Check for lock icon click (Unlock)
                const lockedElementClicked = [...elements].reverse().find(el => {
                    if (!el.locked) return false;
                    const lockX = el.x;
                    const lockY = el.y - 15;
                    return Math.abs(point.x - lockX) < 20 && Math.abs(point.y - lockY) < 20;
                });

                if (lockedElementClicked) {
                    setElements(elements.map(el => el.id === lockedElementClicked.id ? { ...el, locked: false } : el));
                    setSelectedElements([lockedElementClicked.id]);
                    return;
                }

                // Check if clicking on an element
                const clickedElement = [...elements].reverse().find(el => {
                    const cos = Math.cos(-el.rotation);
                    const sin = Math.sin(-el.rotation);
                    const cx = el.x + el.width / 2;
                    const cy = el.y + el.height / 2;
                    const dx = point.x - cx;
                    const dy = point.y - cy;
                    const localX = dx * cos - dy * sin + el.width / 2;
                    const localY = dx * sin + dy * cos + el.height / 2;

                    return localX >= 0 && localX <= el.width && localY >= 0 && localY <= el.height;
                });

                if (clickedElement) {
                    if (e.altKey) {
                        const duplicates = duplicateElements([clickedElement.id]);
                        const newElements = [...elements, ...duplicates];
                        setElements(newElements);
                        setSelectedElements(duplicates.map(d => d.id));
                    } else {
                        if (!e.shiftKey) {
                            // If clicking on an element that is ALREADY selected, 
                            // keep the current selection (to allow dragging the group).
                            // Only reset selection if clicking on an unselected element.
                            if (!selectedElements.includes(clickedElement.id)) {
                                setElements(elements.map(el => ({ ...el, selected: el.id === clickedElement.id })));
                                setSelectedElements([clickedElement.id]);
                            }
                        } else {
                            const isSelected = selectedElements.includes(clickedElement.id);
                            const newSelectedIds = isSelected
                                ? selectedElements.filter(id => id !== clickedElement.id)
                                : [...selectedElements, clickedElement.id];

                            setSelectedElements(newSelectedIds);
                            setElements(elements.map(el => ({ ...el, selected: newSelectedIds.includes(el.id) })));
                        }
                    }
                    setInteractionMode('moving');
                } else {
                    // Start selection box
                    setElements(elements.map(el => ({ ...el, selected: false })));
                    setSelectedElements([]);
                    setSelectionBox({ start: point, end: point });
                    setInteractionMode('selecting');
                }
            } else if (selectedTool !== 'eraser' && selectedTool !== 'laser') {
                // If clicking lock icon to unlock
                const clickedElement = [...elements].reverse().find(el => {
                    const lockX = el.x;
                    const lockY = el.y - 15;
                    const distCheck = Math.abs(point.x - lockX) < 20 && Math.abs(point.y - lockY) < 20;
                    return distCheck && el.locked;
                });

                if (clickedElement) {
                    // Unlock element
                    setElements(elements.map(el => el.id === clickedElement.id ? { ...el, locked: false } : el));
                    setSelectedElements([clickedElement.id]);
                    return;
                }

                // Default: white stroke, transparent fill
                setInteractionMode('drawing');
                const newElement: CanvasElement = {
                    id: generateId(),
                    type: selectedTool as CanvasElement['type'],
                    x: point.x,
                    y: point.y,
                    width: 0,
                    height: 0,
                    rotation: 0,
                    fill: defaultStyles.fill,
                    stroke: defaultStyles.stroke,
                    strokeWidth: defaultStyles.strokeWidth,
                    strokeStyle: selectedTool === 'pencil' ? 'solid' : defaultStyles.strokeStyle,
                    roughness: defaultStyles.roughness,
                    borderRadius: defaultStyles.borderRadius,
                    opacity: defaultStyles.opacity,
                    text: selectedTool === 'text' ? 'Texto' : undefined,
                    fontSize: 20,
                    fontFamily: 'Inter, sans-serif',
                    points: selectedTool === 'pencil' ? [point] : undefined,
                    lineStyle: 'straight',
                    arrowStart: 'none',
                    arrowEnd: selectedTool === 'arrow' ? 'arrow' : 'none',
                    locked: false,
                    selected: false
                };
                setCurrentElement(newElement);
            } else if (selectedTool === 'laser') {
                // Laser pointer - temporary strokes
                setInteractionMode('drawing');
                addLaserPoint(point);
            } else if (selectedTool === 'eraser') {
                setInteractionMode('drawing');
                const newPoint = { x: point.x, y: point.y, timestamp: Date.now() };
                setEraserPath([newPoint]);
                lastEraserPosRef.current = point;

                // Check initial collision with tolerance
                const eraserTolerance = 5 / scale;
                elements.forEach(el => {
                    if (!el.locked && isPointInElement(point, el, eraserTolerance)) {
                        setErasedIds(prev => {
                            const newSet = new Set(prev);
                            newSet.add(el.id);
                            return newSet;
                        });
                    }
                });
            }
        }
    }, [selectedTool, elements, selectedElements, getCanvasCoords, duplicateElements, getResizeHandle, isOnRotationHandle, getLineHandle, defaultStyles]);

    // Mouse move handler
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const point = getCanvasCoords(e);

        if (isPanning) {
            setOffset({
                x: offset.x + e.movementX,
                y: offset.y + e.movementY
            });
            return;
        }

        if (interactionMode === 'selecting' && selectionBox) {
            setSelectionBox({ ...selectionBox, end: point });
            return;
        }

        if (interactionMode === 'rotating' && initialElementState) {
            const cx = initialElementState.x + initialElementState.width / 2;
            const cy = initialElementState.y + initialElementState.height / 2;
            const angle = Math.atan2(point.y - cy, point.x - cx) + Math.PI / 2;

            setElements(elements.map(el => {
                if (selectedElements.includes(el.id)) {
                    return { ...el, rotation: angle };
                }
                return el;
            }));
            return;
        }

        // Handle line/arrow editing (endpoints and control point)
        if (interactionMode === 'editingLine' && activeLineHandle && initialElementState) {
            const el = initialElementState;

            setElements(elements.map(element => {
                if (selectedElements.includes(element.id)) {
                    if (activeLineHandle === 'start') {
                        // Alt for exact points, default for edge snap
                        const snap = getSnapPoint(point, element.id, e.altKey);
                        const targetPoint = snap ? snap.point : point;

                        return {
                            ...element,
                            x: targetPoint.x,
                            y: targetPoint.y,
                            width: el.x + el.width - targetPoint.x,
                            height: el.y + el.height - targetPoint.y,
                            startConnection: snap?.elementId,
                        };
                    } else if (activeLineHandle === 'end') {
                        // Alt for exact points, default for edge snap
                        const snap = getSnapPoint(point, element.id, e.altKey);
                        const targetPoint = snap ? snap.point : point;

                        return {
                            ...element,
                            width: targetPoint.x - el.x,
                            height: targetPoint.y - el.y,
                            endConnection: snap?.elementId,
                        };
                    } else if (activeLineHandle === 'control') {
                        // Move control point for bezier curve
                        return {
                            ...element,
                            controlPoint: { x: point.x, y: point.y },
                        };
                    }
                }
                return element;
            }));
            return;
        }

        if (interactionMode === 'resizing' && activeHandle && initialElementState) {
            const el = initialElementState;
            const dx = point.x - startPoint.x;
            const dy = point.y - startPoint.y;

            // Hold Alt to keep aspect ratio
            const keepRatio = e.altKey;
            const aspectRatio = el.width / el.height;

            let newWidth = el.width;
            let newHeight = el.height;
            let newX = el.x;
            let newY = el.y;

            switch (activeHandle) {
                case 'se':
                    newWidth = Math.max(20, el.width + dx);
                    newHeight = keepRatio ? newWidth / aspectRatio : Math.max(20, el.height + dy);
                    break;
                case 'sw':
                    newWidth = Math.max(20, el.width - dx);
                    newHeight = keepRatio ? newWidth / aspectRatio : Math.max(20, el.height + dy);
                    newX = el.x + el.width - newWidth;
                    break;
                case 'ne':
                    newWidth = Math.max(20, el.width + dx);
                    newHeight = keepRatio ? newWidth / aspectRatio : Math.max(20, el.height - dy);
                    newY = keepRatio ? el.y + el.height - newHeight : el.y + (el.height - newHeight);
                    break;
                case 'nw':
                    newWidth = Math.max(20, el.width - dx);
                    newHeight = keepRatio ? newWidth / aspectRatio : Math.max(20, el.height - dy);
                    newX = el.x + el.width - newWidth;
                    newY = keepRatio ? el.y + el.height - newHeight : el.y + (el.height - newHeight);
                    break;
            }

            setElements(elements.map(element => {
                if (selectedElements.includes(element.id)) {
                    const updatedElement = { ...element, x: newX, y: newY, width: newWidth, height: newHeight };

                    // Scale pencil points
                    if (element.type === 'pencil' && element.id === initialElementState.id && initialElementState.points) {
                        const scaleX = newWidth / initialElementState.width;
                        const scaleY = newHeight / initialElementState.height;

                        updatedElement.points = initialElementState.points.map(p => ({
                            x: newX + (p.x - initialElementState.x) * scaleX,
                            y: newY + (p.y - initialElementState.y) * scaleY
                        }));
                    }

                    // Recalculate height for text
                    if (element.type === 'text') {
                        const ctx = canvasRef.current?.getContext('2d');
                        if (ctx) {
                            const calculatedHeight = calculateTextHeight(ctx, element.text || 'Texto', newWidth, element.fontSize || 20, element.fontFamily || 'Inter, sans-serif');
                            updatedElement.height = calculatedHeight;
                        }
                    }

                    return updatedElement;
                }
                return element;
            }));
            return;
        }

        if (interactionMode === 'moving' && selectedElements.length > 0) {
            const dx = point.x - startPoint.x;
            const dy = point.y - startPoint.y;

            setElements(elements.map(el => {
                if (selectedElements.includes(el.id) && !el.locked) {
                    const newEl = { ...el, x: el.x + dx, y: el.y + dy };

                    // Update points for pencil drawing so it follows the element
                    if (el.type === 'pencil' && el.points) {
                        newEl.points = el.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                    }

                    return newEl;
                }
                return el;
            }));
            setStartPoint(point);
            return;
        }

        if (interactionMode === 'drawing' && currentElement) {
            if (currentElement.type === 'pencil') {
                const newPoints = [...(currentElement.points || []), point];

                // Calculate new bounds dynamically while drawing
                const xs = newPoints.map(p => p.x);
                const ys = newPoints.map(p => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                setCurrentElement({
                    ...currentElement,
                    points: newPoints,
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                });
            } else {
                setCurrentElement({
                    ...currentElement,
                    width: point.x - currentElement.x,
                    height: point.y - currentElement.y
                });
            }
        }

        // Laser pointer drawing
        // Laser pointer drawing
        if (interactionMode === 'drawing' && selectedTool === 'laser') {
            addLaserPoint(point);
        }

        // Eraser drawing
        if (interactionMode === 'drawing' && selectedTool === 'eraser') {
            const newPoint = { x: point.x, y: point.y, timestamp: Date.now() };

            // Update path, keep only recent points (500ms)
            setEraserPath(prev => {
                const now = Date.now();
                const path = prev ? [...prev, newPoint] : [newPoint];
                return path.filter(p => now - p.timestamp < 250);
            });

            // Interpolate between last point and current point to catch fast movements
            const lastPoint = lastEraserPosRef.current;
            const pointsToCheck = [point];

            if (lastPoint) {
                const dist = Math.sqrt(Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2));
                const steps = Math.ceil(dist / (2 / scale)); // Check every 2px approx for extreme precision

                for (let i = 1; i < steps; i++) {
                    const t = i / steps;
                    pointsToCheck.push({
                        x: lastPoint.x + (point.x - lastPoint.x) * t,
                        y: lastPoint.y + (point.y - lastPoint.y) * t
                    });
                }
            }

            // Update ref
            lastEraserPosRef.current = point;

            // Check collision for all interpolated points
            const eraserTolerance = 5 / scale;

            elements.forEach(el => {
                if (!el.locked && !erasedIds.has(el.id)) {
                    for (const p of pointsToCheck) {
                        if (isPointInElement(p, el, eraserTolerance)) {
                            setErasedIds(prev => {
                                const newSet = new Set(prev);
                                newSet.add(el.id);
                                return newSet;
                            });
                            break; // Stop checking points for this element if already hit
                        }
                    }
                }
            });
        }

        // Update cursor and hover states
        if (interactionMode === 'none' || interactionMode === 'selecting') {
            // Check for lock hover first
            let isOverLock = false;
            let overLockId: string | null = null;

            // Search from top (newest) to bottom
            const lockTarget = [...elements].reverse().find(el => {
                if (!el.locked) return false;
                const lockX = el.x;
                const lockY = el.y - 15;
                return Math.abs(point.x - lockX) < 20 && Math.abs(point.y - lockY) < 20;
            });

            if (lockTarget) {
                isOverLock = true;
                overLockId = lockTarget.id;
            }
            setHoveredLock(overLockId);

            if (isOverLock) {
                setCursorStyle('pointer');
                return;
            }

            // Check for selection handles if selected
            const selectedEl = elements.find(el => selectedElements.includes(el.id));
            if (selectedEl && !selectedEl.locked) {
                if (getResizeHandle(point, selectedEl)) {
                    const handle = getResizeHandle(point, selectedEl);
                    if (handle === 'nw' || handle === 'se') setCursorStyle('nwse-resize');
                    else setCursorStyle('nesw-resize');
                    return;
                }
                if (isOnRotationHandle(point, selectedEl)) {
                    setCursorStyle('crosshair');
                    return;
                }
                if ((selectedEl.type === 'line' || selectedEl.type === 'arrow') && getLineHandle(point, selectedEl)) {
                    setCursorStyle('grab');
                    return;
                }
            }

            // Check for standard element hover (draggable)
            const hoveredEl = [...elements].reverse().find(el => {
                // Check simplified bounds for cursor detection to be snappy
                const cx = el.x + el.width / 2;
                const cy = el.y + el.height / 2;
                // Simple box check for cursor is usually enough, but let's stick to the existing logic if possible.
                // Using the same logic as handleMouseDown for consistency
                const cos = Math.cos(-el.rotation);
                const sin = Math.sin(-el.rotation);
                const dx = point.x - cx;
                const dy = point.y - cy;
                const localX = dx * cos - dy * sin + el.width / 2;
                const localY = dx * sin + dy * cos + el.height / 2;
                return localX >= 0 && localX <= el.width && localY >= 0 && localY <= el.height;
            });

            if (hoveredEl && !hoveredEl.locked && selectedTool === 'select') {
                setCursorStyle('move');
            } else {
                setCursorStyle('default');
            }
        }
    }, [isPanning, interactionMode, selectedElements, elements, startPoint, currentElement, getCanvasCoords, offset, selectionBox, activeHandle, initialElementState, activeLineHandle, getSnapPoint, selectedTool, addLaserPoint, getResizeHandle, isOnRotationHandle, getLineHandle]);

    // Mouse up handler
    const handleMouseUp = useCallback(() => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        // Handle selection box
        if (interactionMode === 'selecting' && selectionBox) {
            const boxX = Math.min(selectionBox.start.x, selectionBox.end.x);
            const boxY = Math.min(selectionBox.start.y, selectionBox.end.y);
            const boxW = Math.abs(selectionBox.end.x - selectionBox.start.x);
            const boxH = Math.abs(selectionBox.end.y - selectionBox.start.y);

            if (boxW > 5 && boxH > 5) {
                const selectedIds = elements
                    .filter(el => {
                        const elCenterX = el.x + el.width / 2;
                        const elCenterY = el.y + el.height / 2;
                        return elCenterX >= boxX && elCenterX <= boxX + boxW &&
                            elCenterY >= boxY && elCenterY <= boxY + boxH;
                    })
                    .filter(el => !el.locked) // Exclude locked elements from area selection
                    .map(el => el.id);

                if (selectedIds.length > 0) {
                    setElements(elements.map(el => ({ ...el, selected: selectedIds.includes(el.id) })));
                    setSelectedElements(selectedIds);
                }
            }
            setSelectionBox(null);
        }

        if (interactionMode === 'rotating' || interactionMode === 'resizing' || interactionMode === 'editingLine') {
            addToHistory(elements);
        }

        if (interactionMode === 'drawing' && currentElement) {
            const finalElement = { ...currentElement };

            if (finalElement.width < 0) {
                finalElement.x += finalElement.width;
                finalElement.width = Math.abs(finalElement.width);
            }
            if (finalElement.height < 0) {
                finalElement.y += finalElement.height;
                finalElement.height = Math.abs(finalElement.height);
            }

            if (finalElement.width > 5 || finalElement.height > 5 ||
                finalElement.type === 'pencil' || finalElement.type === 'text') {

                if (finalElement.type !== 'pencil') {
                    finalElement.selected = true;
                    setSelectedElements([finalElement.id]);
                    setSelectedTool('select');
                }

                const newElements = elements.map(el => ({ ...el, selected: false }));
                newElements.push(finalElement);

                setElements(newElements);
                if (finalElement.type !== 'pencil') {
                    // For non-pencil, switch to select tool and select the new element
                    // For pencil, we stay in pencil tool and do NOT select it
                }
                addToHistory(newElements);

                if (finalElement.type === 'text') {
                    setEditingTextId(finalElement.id);
                }
            }
        } else if (interactionMode === 'moving' && selectedElements.length > 0) {
            addToHistory(elements);
        }

        // Finish laser stroke
        finishLaserStroke();

        // Finish eraser stroke
        if (selectedTool === 'eraser' && erasedIds.size > 0) {
            // Remove erased elements
            const newElements = elements.filter(el => !erasedIds.has(el.id));
            setElements(newElements);
            addToHistory(newElements);
            setErasedIds(new Set());
            setEraserPath(null);
        } else if (selectedTool === 'eraser') {
            setEraserPath(null);
            lastEraserPosRef.current = null;
        }

        setInteractionMode('none');
        setCurrentElement(null);
        setActiveHandle(null);
        setActiveLineHandle(null);
        setIsRotating(false);
        setInitialElementState(null);
    }, [isPanning, interactionMode, currentElement, elements, selectedElements, addToHistory, selectionBox, finishLaserStroke, erasedIds, selectedTool]);

    // Double click for text editing
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        const point = getCanvasCoords(e);
        const clickedElement = [...elements].reverse().find(el => {
            return point.x >= el.x && point.x <= el.x + el.width &&
                point.y >= el.y && point.y <= el.y + el.height &&
                el.type === 'text';
        });

        if (clickedElement) {
            setEditingTextId(clickedElement.id);
        }
    }, [elements, getCanvasCoords]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!e.ctrlKey && !e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'v': setSelectedTool('select'); break;
                    case 'h': setSelectedTool('hand'); break;
                    case 'r': setSelectedTool('rectangle'); break;
                    case 'o': setSelectedTool('ellipse'); break;
                    case 'd': setSelectedTool('diamond'); break;
                    case 'a': setSelectedTool('arrow'); break;
                    case 'l': setSelectedTool('line'); break;
                    case 't': setSelectedTool('text'); break;
                    case 'p': setSelectedTool('pencil'); break;
                    case 'e': setSelectedTool('eraser'); break;
                    case 'delete':
                    case 'backspace':
                        if (!editingTextId) deleteSelected();
                        break;
                }
            }

            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        if (e.shiftKey) {
                            redo();
                        } else {
                            undo();
                        }
                        e.preventDefault();
                        break;
                    case 'y':
                        redo();
                        e.preventDefault();
                        break;
                    case 'c':
                        copySelected();
                        e.preventDefault();
                        break;
                    case 'v':
                        paste();
                        e.preventDefault();
                        break;
                    case 'a':
                        setSelectedElements(elements.map(el => el.id));
                        setElements(elements.map(el => ({ ...el, selected: true })));
                        e.preventDefault();
                        break;
                }
            }

            if (e.key === 'Escape') {
                setSelectedElements([]);
                setElements(elements.map(el => ({ ...el, selected: false })));
                setEditingTextId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [elements, selectedElements, editingTextId, deleteSelected, undo, redo, copySelected, paste]);

    // Wheel for zoom and pan
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
            // Zoom centered on mouse
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(Math.max(0.1, scale * zoomFactor), 5);

            // Calculate new offset to keep the point under mouse stationary
            // formula: newOffset = mouse - (mouse - oldOffset) * (newScale / oldScale)
            const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale);
            const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale);

            setScale(newScale);
            setOffset({ x: newOffsetX, y: newOffsetY });
        } else if (e.shiftKey) {
            setOffset({
                x: offset.x - e.deltaY,
                y: offset.y
            });
        } else {
            setOffset({
                x: offset.x - e.deltaX,
                y: offset.y - e.deltaY
            });
        }
    }, [scale, offset]);

    // Disable browser zoom on Canva page
    useEffect(() => {
        const preventBrowserZoom = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        };

        const preventKeyboardZoom = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
                e.preventDefault();
            }
        };

        document.addEventListener('wheel', preventBrowserZoom, { passive: false });
        document.addEventListener('keydown', preventKeyboardZoom);

        return () => {
            document.removeEventListener('wheel', preventBrowserZoom);
            document.removeEventListener('keydown', preventKeyboardZoom);
        };
    }, []);

    // Animate laser strokes and eraser fade - continuous loop while strokes exist
    useEffect(() => {
        let animationId: number;

        const animate = () => {
            if (laserStrokes.length > 0 || currentLaserStroke || (eraserPath && eraserPath.length > 0)) {
                render();
                animationId = requestAnimationFrame(animate);
            }
        };

        if (laserStrokes.length > 0 || currentLaserStroke || (eraserPath && eraserPath.length > 0)) {
            animationId = requestAnimationFrame(animate);
        }

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, [laserStrokes.length, currentLaserStroke, eraserPath, render]);

    // Resize canvas
    useEffect(() => {
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (canvas && container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                render();
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [render]);

    // Render loop
    useEffect(() => {
        render();
    }, [render]);

    // Zoom controls
    const zoomIn = () => setScale(Math.min(scale * 1.2, 5));
    const zoomOut = () => setScale(Math.max(scale / 1.2, 0.1));
    const resetZoom = () => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    };

    // Toggle lock
    const toggleLock = () => {
        const newElements = elements.map(el => {
            if (selectedElements.includes(el.id)) {
                return { ...el, locked: !el.locked };
            }
            return el;
        });
        setElements(newElements);
        addToHistory(newElements);
    };

    // Export as PNG
    const exportCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `rovena-canva-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    // Get cursor style
    // Get cursor style
    const getCursor = () => {
        if (selectedTool === 'hand' || isPanning) return 'grab';
        if (isRotating) return 'crosshair';
        if (activeHandle) {
            if (activeHandle === 'nw' || activeHandle === 'se') return 'nwse-resize';
            return 'nesw-resize';
        }
        return cursorStyle;
    };

    return (
        <div className="canva-page">
            {/* Toolbar */}
            <div className="canva-toolbar">
                <div className="toolbar-left" />

                <div className="toolbar-center">
                    <div className="toolbar-group">
                        {mainTools.map((tool) => (
                            <button
                                key={tool.id}
                                className={`toolbar-btn ${selectedTool === tool.id ? 'active' : ''}`}
                                onClick={() => setSelectedTool(tool.id)}
                                title={`${tool.label} (${tool.shortcut})`}
                            >
                                <tool.icon size={18} />
                            </button>
                        ))}
                    </div>

                    <div className="toolbar-separator" />

                    <div className="toolbar-group">
                        {drawingTools.map((tool) => (
                            <button
                                key={tool.id}
                                className={`toolbar-btn ${selectedTool === tool.id ? 'active' : ''}`}
                                onClick={() => setSelectedTool(tool.id)}
                                title={`${tool.label} (${tool.shortcut})`}
                            >
                                <tool.icon size={18} />
                            </button>
                        ))}
                    </div>

                    <div className="toolbar-separator" />

                    <div className="toolbar-group">
                        <button
                            className="toolbar-btn"
                            onClick={undo}
                            title="Desfazer (Ctrl+Z)"
                            disabled={historyIndex <= 0}
                        >
                            <Undo2 size={18} />
                        </button>
                        <button
                            className="toolbar-btn"
                            onClick={redo}
                            title="Refazer (Ctrl+Y)"
                            disabled={historyIndex >= history.length - 1}
                        >
                            <Redo2 size={18} />
                        </button>
                    </div>
                </div>

                <div className="toolbar-right">
                    <div className="toolbar-group zoom-controls">
                        <button className="toolbar-btn" onClick={zoomOut} title="Diminuir zoom">
                            <ZoomOut size={18} />
                        </button>
                        <button className="zoom-label" onClick={resetZoom} title="Resetar zoom">
                            {Math.round(scale * 100)}%
                        </button>
                        <button className="toolbar-btn" onClick={zoomIn} title="Aumentar zoom">
                            <ZoomIn size={18} />
                        </button>
                    </div>

                    <button className="toolbar-btn export-btn" onClick={exportCanvas} title="Exportar PNG">
                        <Download size={18} />
                        <span>Exportar</span>
                    </button>
                </div>
            </div>

            {/* Canvas container */}
            <div
                ref={containerRef}
                className="canva-container"
                onWheel={handleWheel}
            >
                <canvas
                    ref={canvasRef}
                    className="canva-canvas"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                    style={{ cursor: getCursor() }}
                />

                {/* Floating Properties Panel - Shows when element is selected OR pencil tool is active */}
                {((selectedElement && selectedElements.length > 0) || selectedTool === 'pencil') && (
                    <div className="floating-panel">
                        {(() => {
                            // Determine if we are editing a selected element or default styles
                            const isEditingDefault = !selectedElement;
                            const currentStyle = isEditingDefault
                                ? { ...defaultStyles, type: 'pencil' } as CanvasElement
                                : selectedElement;

                            const handleStyleUpdate = (updates: any) => {
                                if (isEditingDefault) {
                                    setDefaultStyles(prev => ({ ...prev, ...updates }));
                                } else {
                                    updateSelectedElement(updates);
                                }
                            };

                            return (
                                <>
                                    {currentStyle.type === 'text' ? (
                                        <>
                                            <div className="panel-section">
                                                <span className="panel-label">Fonte</span>
                                                <div className="text-controls" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                    <select
                                                        className="font-select"
                                                        value={currentStyle.fontFamily || 'Inter, sans-serif'}
                                                        onChange={(e) => handleStyleUpdate({ fontFamily: e.target.value })}
                                                        style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }}
                                                    >
                                                        <option value="Inter, sans-serif">Inter</option>
                                                        <option value="Arial, sans-serif">Arial</option>
                                                        <option value="Times New Roman, serif">Times New Roman</option>
                                                        <option value="Courier New, monospace">Courier New</option>
                                                        <option value="Brush Script MT, cursive">Brush Script</option>
                                                    </select>
                                                    <input
                                                        type="number"
                                                        value={currentStyle.fontSize || 20}
                                                        onChange={(e) => handleStyleUpdate({ fontSize: parseInt(e.target.value) })}
                                                        style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="panel-section">
                                                <span className="panel-label">Cor</span>
                                                <div className="color-grid">
                                                    {colors.map(color => (
                                                        <button
                                                            key={color}
                                                            className={`color-btn ${currentStyle.stroke === color ? 'active' : ''}`}
                                                            style={{ backgroundColor: color }}
                                                            onClick={() => handleStyleUpdate({ stroke: color })}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="panel-section">
                                                <span className="panel-label">Contorno</span>
                                                <div className="color-grid">
                                                    {colors.map(color => (
                                                        <button
                                                            key={color}
                                                            className={`color-btn ${currentStyle.stroke === color ? 'active' : ''}`}
                                                            style={{ backgroundColor: color }}
                                                            onClick={() => handleStyleUpdate({ stroke: color })}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="panel-section">
                                                <span className="panel-label">Fundo</span>
                                                <div className="color-grid">
                                                    <button
                                                        className={`color-btn transparent ${currentStyle.fill === 'transparent' ? 'active' : ''}`}
                                                        onClick={() => handleStyleUpdate({ fill: 'transparent' })}
                                                        title="Transparente"
                                                    />
                                                    {colors.map(color => (
                                                        <button
                                                            key={color}
                                                            className={`color-btn ${currentStyle.fill === color ? 'active' : ''}`}
                                                            style={{ backgroundColor: color }}
                                                            onClick={() => handleStyleUpdate({ fill: color })}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="panel-section">
                                                <span className="panel-label">Espessura do traço</span>
                                                <div className="stroke-grid">
                                                    {strokeWidths.map(width => (
                                                        <button
                                                            key={width}
                                                            className={`stroke-btn ${currentStyle.strokeWidth === width ? 'active' : ''}`}
                                                            onClick={() => handleStyleUpdate({ strokeWidth: width })}
                                                        >
                                                            <div className="stroke-line" style={{ height: width }} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Hide stroke style and roughness for pencil */}
                                            {currentStyle.type !== 'pencil' && (
                                                <>
                                                    <div className="panel-section">
                                                        <span className="panel-label">Estilo do traço</span>
                                                        <div className="style-grid">
                                                            <button
                                                                className={`style-btn ${currentStyle.strokeStyle === 'solid' ? 'active' : ''}`}
                                                                onClick={() => handleStyleUpdate({ strokeStyle: 'solid' })}
                                                                title="Sólido"
                                                            >
                                                                <div className="style-line solid" />
                                                            </button>
                                                            <button
                                                                className={`style-btn ${currentStyle.strokeStyle === 'dashed' ? 'active' : ''}`}
                                                                onClick={() => handleStyleUpdate({ strokeStyle: 'dashed' })}
                                                                title="Tracejado"
                                                            >
                                                                <div className="style-line dashed" />
                                                            </button>
                                                            <button
                                                                className={`style-btn ${currentStyle.strokeStyle === 'dotted' ? 'active' : ''}`}
                                                                onClick={() => handleStyleUpdate({ strokeStyle: 'dotted' })}
                                                                title="Pontilhado"
                                                            >
                                                                <div className="style-line dotted" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="panel-section">
                                                        <span className="panel-label">Precisão do traço</span>
                                                        <div className="style-grid">
                                                            <button
                                                                className={`style-btn ${currentStyle.roughness === 0 ? 'active' : ''}`}
                                                                onClick={() => handleStyleUpdate({ roughness: 0 })}
                                                                title="Suave"
                                                            >
                                                                <svg width="20" height="14" viewBox="0 0 20 14">
                                                                    <path d="M2 12 Q10 2, 18 12" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                className={`style-btn ${currentStyle.roughness === 1 ? 'active' : ''}`}
                                                                onClick={() => handleStyleUpdate({ roughness: 1 })}
                                                                title="Normal"
                                                            >
                                                                <svg width="20" height="14" viewBox="0 0 20 14">
                                                                    <path d="M2 12 Q5 8, 7 10 Q10 2, 13 8 Q16 6, 18 12" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                className={`style-btn ${currentStyle.roughness === 2 ? 'active' : ''}`}
                                                                onClick={() => handleStyleUpdate({ roughness: 2 })}
                                                                title="Áspero"
                                                            >
                                                                <svg width="20" height="14" viewBox="0 0 20 14">
                                                                    <path d="M2 10 L4 6 L6 11 L8 4 L10 9 L12 5 L14 10 L16 7 L18 11" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* Only show Arestas for shapes with corners */}
                                            {currentStyle.type !== 'arrow' && currentStyle.type !== 'line' && currentStyle.type !== 'pencil' && currentStyle.type !== 'ellipse' && (
                                                <div className="panel-section">
                                                    <span className="panel-label">Arestas</span>
                                                    <div className="style-grid edges-grid">
                                                        <button
                                                            className={`style-btn ${currentStyle.borderRadius === 0 ? 'active' : ''}`}
                                                            onClick={() => handleStyleUpdate({ borderRadius: 0 })}
                                                            title="Retas"
                                                        >
                                                            <svg width="20" height="16" viewBox="0 0 20 16">
                                                                <rect x="2" y="2" width="16" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            className={`style-btn ${currentStyle.borderRadius === 1 ? 'active' : ''}`}
                                                            onClick={() => handleStyleUpdate({ borderRadius: 1 })}
                                                            title="Arredondadas"
                                                        >
                                                            <svg width="20" height="16" viewBox="0 0 20 16">
                                                                <rect x="2" y="2" width="16" height="12" rx="4" ry="4" stroke="currentColor" strokeWidth="2" fill="none" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Arrow/Line type options - only for arrows and lines */}
                                            {(currentStyle.type === 'arrow' || currentStyle.type === 'line') && (
                                                <>
                                                    <div className="panel-section">
                                                        <span className="panel-label">{currentStyle.type === 'arrow' ? 'Tipo de seta' : 'Tipo de linha'}</span>
                                                        <div className="style-grid">
                                                            <button
                                                                className={`style-btn ${currentStyle.lineStyle === 'straight' ? 'active' : ''}`}
                                                                onClick={() => handleStyleUpdate({ lineStyle: 'straight', controlPoint: undefined })}
                                                                title="Reta"
                                                            >
                                                                <svg width="20" height="14" viewBox="0 0 20 14">
                                                                    <line x1="2" y1="12" x2="18" y2="2" stroke="currentColor" strokeWidth="2" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                className={`style-btn ${currentStyle.lineStyle === 'elbow' ? 'active' : ''}`}
                                                                onClick={() => handleStyleUpdate({ lineStyle: 'elbow' })}
                                                                title="Ângulo"
                                                            >
                                                                <svg width="20" height="14" viewBox="0 0 20 14">
                                                                    <polyline points="2,12 10,12 18,2" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                className={`style-btn ${currentStyle.lineStyle === 'curve' ? 'active' : ''}`}
                                                                onClick={() => handleStyleUpdate({ lineStyle: 'curve' })}
                                                                title="Curva"
                                                            >
                                                                <svg width="20" height="14" viewBox="0 0 20 14">
                                                                    <path d="M2 12 Q10 2, 18 12" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {currentStyle.type === 'arrow' && (
                                                        <div className="panel-section">
                                                            <span className="panel-label">Pontas</span>
                                                            <div className="style-grid">
                                                                <button
                                                                    className={`style-btn ${currentStyle.arrowStart === 'none' && currentStyle.arrowEnd === 'arrow' ? 'active' : ''}`}
                                                                    onClick={() => handleStyleUpdate({ arrowStart: 'none', arrowEnd: 'arrow' })}
                                                                    title="Seta no fim"
                                                                >
                                                                    <svg width="20" height="14" viewBox="0 0 20 14">
                                                                        <line x1="2" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="2" />
                                                                        <polyline points="12,4 18,7 12,10" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    className={`style-btn ${currentStyle.arrowStart === 'arrow' && currentStyle.arrowEnd === 'arrow' ? 'active' : ''}`}
                                                                    onClick={() => handleStyleUpdate({ arrowStart: 'arrow', arrowEnd: 'arrow' })}
                                                                    title="Seta dupla"
                                                                >
                                                                    <svg width="20" height="14" viewBox="0 0 20 14">
                                                                        <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="2" />
                                                                        <polyline points="8,4 2,7 8,10" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                        <polyline points="12,4 18,7 12,10" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}

                                    <div className="panel-section">
                                        <span className="panel-label">Opacidade</span>
                                        <div className="opacity-control">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={currentStyle.opacity * 100}
                                                onChange={(e) => handleStyleUpdate({ opacity: parseInt(e.target.value) / 100 })}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(currentStyle.opacity * 100)}</span>
                                        </div>
                                    </div>


                                    {!isEditingDefault && (
                                        <>
                                            <div className="panel-section">
                                                <span className="panel-label">Camadas</span>
                                                <div className="layer-buttons">
                                                    <button className="layer-btn" onClick={() => moveElementLayer('down')} title="Mover para trás">
                                                        <ChevronDown size={16} />
                                                    </button>
                                                    <button className="layer-btn" onClick={() => moveElementLayer('up')} title="Mover para frente">
                                                        <ChevronUp size={16} />
                                                    </button>
                                                    <button className="layer-btn" onClick={() => moveElementLayer('bottom')} title="Enviar para trás">
                                                        <Layers size={16} />↓
                                                    </button>
                                                    <button className="layer-btn" onClick={() => moveElementLayer('top')} title="Trazer para frente">
                                                        <Layers size={16} />↑
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="panel-section">
                                                <span className="panel-label">Ações</span>
                                                <div className="action-buttons">
                                                    <button className="action-btn" onClick={copySelected} title="Copiar">
                                                        <Copy size={16} />
                                                    </button>
                                                    <button className="action-btn" onClick={deleteSelected} title="Excluir">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button
                                                        className={`action-btn ${currentStyle.locked ? 'active' : ''}`}
                                                        onClick={toggleLock}
                                                        title="Bloquear/Desbloquear"
                                                    >
                                                        {currentStyle.locked ? <Unlock size={16} /> : <Lock size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* Text editing overlay */}
                {editingTextId && (() => {
                    const textElement = elements.find(el => el.id === editingTextId);
                    if (!textElement) return null;

                    return (
                        <textarea
                            ref={textInputRef}
                            className="text-edit-input"
                            style={{
                                left: textElement.x * scale + offset.x,
                                top: textElement.y * scale + offset.y,
                                fontSize: (textElement.fontSize || 20) * scale,
                                color: textElement.stroke,
                                fontFamily: textElement.fontFamily || 'Inter, sans-serif',
                                width: textElement.width * scale,
                                height: textElement.height * scale,
                                border: '1px dashed rgba(34, 197, 94, 0.5)',
                                background: 'transparent',
                                padding: '0',
                                margin: '0',
                                overflow: 'hidden',
                                resize: 'none',
                                outline: 'none',
                                textAlign: textElement.type === 'text' ? 'left' : 'center',
                                lineHeight: '1.2'
                            }}
                            value={textElement.text || ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                                setElements(elements.map(el =>
                                    el.id === editingTextId
                                        ? { ...el, text: e.target.value }
                                        : el
                                ));
                            }}
                            onBlur={() => {
                                setEditingTextId(null);
                                addToHistory(elements);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setEditingTextId(null);
                                }
                            }}
                            autoFocus
                        />
                    );
                })()}

                {/* Help text */}
                <div className="canva-help">
                    <kbd>Scroll</kbd>(mover) •
                    <kbd>Ctrl+Scroll</kbd>(zoom) •
                    <kbd>Shift+Scroll</kbd>(horizontal) •
                    <kbd>Alt+Arrastar</kbd>(duplicar)
                </div>
            </div>
        </div>
    );
}

export default Canva;
