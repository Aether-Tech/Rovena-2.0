import { useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
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
    const graphRef = useRef<any>();
    const containerRef = useRef<HTMLDivElement>(null);

    const graphData = useMemo((): GraphData => {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];

        folders.forEach((folder) => {
            nodes.push({
                id: folder.id,
                name: folder.name,
                type: 'folder',
                val: 50, // Increased val for larger logic radius (prevents culling)
                color: '#8b5cf6',
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
                color: '#22c55e',
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
        if (graphRef.current) {
            graphRef.current.d3Force('charge').strength(-300); // Reduced repulsion
            graphRef.current.d3Force('link').distance(100);
            graphRef.current.d3Force('center').strength(0.05);
            // Ensure larger collision radius to match visual space
            graphRef.current.d3Force('collide', graphRef.current.d3Force().radius(40));
        }
    }, [graphData]);

    const handleNodeClick = (node: any) => {
        if (node.id !== 'empty') {
            onNodeClick(node.id, node.type);
        }
    };

    return (
        <div className="graph-view-container" ref={containerRef}>
            <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
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
                    ctx.shadowColor = node.type === 'folder' ? 'rgba(250, 204, 21, 0.6)' : 'rgba(34, 197, 94, 0.6)';
                    ctx.shadowBlur = 20 / globalScale;

                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, visualRadius);
                    if (node.type === 'folder') {
                        gradient.addColorStop(0, '#fbbf24');
                        gradient.addColorStop(1, '#d97706');
                    } else {
                        gradient.addColorStop(0, '#4ade80');
                        gradient.addColorStop(1, '#16a34a');
                    }

                    ctx.beginPath();
                    ctx.arc(x, y, visualRadius, 0, 2 * Math.PI);
                    ctx.fillStyle = gradient;
                    ctx.fill();

                    // Border
                    ctx.strokeStyle = node.type === 'folder' ? '#fef3c7' : '#bbf7d0';
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

                    ctx.fillStyle = node.type === 'folder' ? '#fde047' : '#dcfce7';
                    ctx.fillText(label, x, textY);

                    ctx.restore();
                }}
                nodeCanvasObjectMode={() => 'replace'}
                linkColor={() => 'rgba(34, 197, 94, 0.2)'}
                linkWidth={1.5}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleColor={() => '#4ade80'}
                onNodeClick={handleNodeClick}
                backgroundColor="transparent"
                warmupTicks={100}
                cooldownTicks={0}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                enableNodeDrag={true}
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
                    if (node) {
                        node.fx = node.x;
                        node.fy = node.y;
                    }
                }}
            />
        </div>
    );
}
