import { useEffect, useRef, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide } from 'd3-force-3d';
import type { Note, Folder } from '../services/notesStorage';
import './GraphView.css';

interface GraphNode {
    id: string;
    name: string;
    type: 'folder' | 'note';
    val: number;
    color: string;
}

interface GraphLink {
    source: string;
    target: string;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

interface GraphViewProps {
    notes: Note[];
    folders: Folder[];
    onNodeClick: (nodeId: string, type: 'folder' | 'note') => void;
}

export function GraphView({ notes, folders, onNodeClick }: GraphViewProps) {
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragFlagRef = useRef(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            const { width, height } = container.getBoundingClientRect();
            setDimensions({
                width: Math.max(1, Math.floor(width)),
                height: Math.max(1, Math.floor(height)),
            });
        };

        updateSize();

        const resizeObserver = new ResizeObserver(() => updateSize());
        resizeObserver.observe(container);
        window.addEventListener('resize', updateSize);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateSize);
        };
    }, []);

    const graphData = useMemo((): GraphData => {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];

        folders.forEach((folder) => {
            nodes.push({
                id: folder.id,
                name: folder.name,
                type: 'folder',
                val: 50, // Increased val for larger logic radius (prevents culling)
                color: '#3b82f6',
            });

            if (folder.parentId) {
                links.push({
                    source: folder.parentId,
                    target: folder.id,
                });
            }
        });

        notes.forEach((note) => {
            nodes.push({
                id: note.id,
                name: note.title,
                type: 'note',
                val: 30, // Increased val for larger logic radius
                color: '#a855f7',
            });

            if (note.folderId) {
                links.push({
                    source: note.folderId,
                    target: note.id,
                });
            }
        });

        if (nodes.length === 0) {
            nodes.push({
                id: 'empty',
                name: 'Sem notas ou pastas',
                type: 'note',
                val: 30,
                color: '#64748b',
            });
        }

        return { nodes, links };
    }, [notes, folders]);

    useEffect(() => {
        if (!graphRef.current) return;

        const collideForce = forceCollide()
            .radius((node: any) => Math.max(18, Math.sqrt(node.val || 1) * 4))
            .strength(1);

        graphRef.current.d3Force('charge').strength(-320);
        graphRef.current.d3Force('link').distance(120);
        graphRef.current.d3Force('center').strength(0.08);
        graphRef.current.d3Force('collide', collideForce);
        graphRef.current.d3ReheatSimulation();
    }, [graphData]);

    const handleNodeClick = (node: any) => {
        if (dragFlagRef.current) return;
        if (node.id !== 'empty') {
            onNodeClick(node.id, node.type);
        }
    };

    return (
        <div className="graph-view-container" ref={containerRef}>
            <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                width={dimensions.width}
                height={dimensions.height}
                nodeLabel="name"
                nodeVal="val"
                nodeColor="color"
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const x = node.x;
                    const y = node.y;

                    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
                        return;
                    }

                    const label = node.name || '';
                    const fontSize = 14 / globalScale;

                    // Use fixed visual sizes regardless of the large physics 'val' used for culling protection
                    const visualRadius = node.type === 'folder' ? 12 : 7;

                    ctx.save();

                    // Glow effect
                    ctx.shadowColor = node.type === 'folder' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(168, 85, 247, 0.6)';
                    ctx.shadowBlur = 20 / globalScale;

                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, visualRadius);
                    if (node.type === 'folder') {
                        gradient.addColorStop(0, '#3b82f6');
                        gradient.addColorStop(1, '#2563eb');
                    } else {
                        gradient.addColorStop(0, '#a855f7');
                        gradient.addColorStop(1, '#9333ea');
                    }

                    ctx.beginPath();
                    ctx.arc(x, y, visualRadius, 0, 2 * Math.PI);
                    ctx.fillStyle = gradient;
                    ctx.fill();

                    // Border
                    ctx.strokeStyle = node.type === 'folder' ? '#dbeafe' : '#f3e8ff';
                    ctx.lineWidth = 2 / globalScale;
                    ctx.stroke();

                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;

                    // Label
                    ctx.font = `600 ${fontSize}px 'Inter', -apple-system, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const textY = y + visualRadius + fontSize + 4 / globalScale;

                    // Text shadow for readability
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
                    ctx.fillText(label, x + 1 / globalScale, textY + 1 / globalScale);

                    ctx.fillStyle = node.type === 'folder' ? '#bfdbfe' : '#f3e8ff';
                    ctx.fillText(label, x, textY);

                    ctx.restore();
                }}
                nodeCanvasObjectMode={() => 'replace'}
                linkColor={() => 'rgba(168, 85, 247, 0.2)'}
                linkWidth={1.5}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleColor={() => '#a855f7'}
                onNodeClick={handleNodeClick}
                backgroundColor="transparent"
                warmupTicks={100}
                cooldownTicks={0}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                enableNodeDrag={true}
                onNodeDrag={() => {
                    dragFlagRef.current = true;
                }}

                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                    // Use larger radius for hit area to facilitate dragging and prevent culling
                    const hitRadius = Math.sqrt((node.val || 1)) * 4;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, hitRadius, 0, 2 * Math.PI);
                    ctx.fill();
                }}
                onNodeHover={(node: any) => {
                    document.body.style.cursor = node ? 'pointer' : 'grab';
                }}
                onNodeDragEnd={(node: any) => {
                    dragFlagRef.current = false;
                    if (node) {
                        node.fx = node.x;
                        node.fy = node.y;
                    }
                }}
            />
        </div>
    );
}
