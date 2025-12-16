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
                val: 15,
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
                val: 8,
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
                val: 10,
                color: '#64748b',
            });
        }

        return { nodes, links };
    }, [notes, folders]);

    useEffect(() => {
        if (graphRef.current) {
            graphRef.current.d3Force('charge').strength(-300);
            graphRef.current.d3Force('link').distance(100);
            graphRef.current.d3Force('center').strength(0.1);
        }
    }, []);

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
                    const label = node.name;
                    const fontSize = 13 / globalScale;
                    const nodeRadius = Math.sqrt(node.val) * 2.5;

                    ctx.save();

                    ctx.shadowColor = node.type === 'folder' ? 'rgba(139, 92, 246, 0.6)' : 'rgba(34, 197, 94, 0.6)';
                    ctx.shadowBlur = 20 / globalScale;

                    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeRadius);
                    gradient.addColorStop(0, node.color);
                    gradient.addColorStop(1, node.type === 'folder' ? '#6d28d9' : '#16a34a');

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
                    ctx.fillStyle = gradient;
                    ctx.fill();

                    ctx.strokeStyle = node.type === 'folder' ? '#a78bfa' : '#4ade80';
                    ctx.lineWidth = 2.5 / globalScale;
                    ctx.stroke();

                    if (node.type === 'folder') {
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = 1.5 / globalScale;
                        ctx.setLineDash([3 / globalScale, 3 / globalScale]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;

                    ctx.font = `600 ${fontSize}px 'Inter', -apple-system, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.fillText(label, node.x + 1 / globalScale, node.y + nodeRadius + fontSize + 3 / globalScale);

                    ctx.fillStyle = node.type === 'folder' ? '#e9d5ff' : '#d1fae5';
                    ctx.fillText(label, node.x, node.y + nodeRadius + fontSize + 2 / globalScale);

                    ctx.restore();
                }}
                nodeCanvasObjectMode={() => 'replace'}
                linkColor={(link: any) => {
                    return 'rgba(139, 92, 246, 0.3)';
                }}
                linkWidth={1.5}
                linkDirectionalParticles={3}
                linkDirectionalParticleWidth={3}
                linkDirectionalParticleSpeed={0.008}
                linkDirectionalParticleColor={() => '#8b5cf6'}
                onNodeClick={handleNodeClick}
                backgroundColor="transparent"
                warmupTicks={100}
                cooldownTicks={0}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                enableNodeDrag={true}
                onNodeHover={(node: any) => {
                    document.body.style.cursor = node ? 'pointer' : 'default';
                }}
            />
        </div>
    );
}
