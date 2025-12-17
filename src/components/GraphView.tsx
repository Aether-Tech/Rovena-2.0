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
    onMoveNote?: (noteId: string, newFolderId: string | null) => void;
    onMoveFolder?: (folderId: string, newParentId: string | null) => void;
}

export function GraphView({ notes, folders, onNodeClick, onMoveNote, onMoveFolder }: GraphViewProps) {
    const graphRef = useRef<any>();
    const containerRef = useRef<HTMLDivElement>(null);
    const dragFlagRef = useRef(false);
    const draggedNodeRef = useRef<any>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [dropTarget, setDropTarget] = useState<any>(null);
    const [selectedNodeIndex, setSelectedNodeIndex] = useState(0);

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
                val: 50,
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
                val: 30,
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
        if (!graphRef.current) return;

        const collideForce = forceCollide<GraphNode>()
            .radius((node) => Math.max(18, Math.sqrt(node.val || 1) * 4))
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

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const allNodes = graphData.nodes.filter(n => n.id !== 'empty');
            if (allNodes.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedNodeIndex((prev) => (prev + 1) % allNodes.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedNodeIndex((prev) => (prev - 1 + allNodes.length) % allNodes.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selectedNode = allNodes[selectedNodeIndex];
                if (selectedNode) {
                    onNodeClick(selectedNode.id, selectedNode.type);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [graphData, selectedNodeIndex, onNodeClick]);

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
                    const visualRadius = node.type === 'folder' ? 12 : 7;

                    ctx.save();

                      // Highlight selected node
                      const allNodes = graphData.nodes.filter(n => n.id !== 'empty');
                      const selectedNode = allNodes[selectedNodeIndex];
                      if (selectedNode && selectedNode.id === node.id) {
                          ctx.shadowColor = '#3b82f6';
                          ctx.shadowBlur = 30 / globalScale;
                          ctx.strokeStyle = '#3b82f6';
                          ctx.lineWidth = 4 / globalScale;
                          ctx.beginPath();
                          ctx.arc(x, y, visualRadius + 8, 0, 2 * Math.PI);
                          ctx.stroke();
                      }

                      // Highlight drop target
                      if (dropTarget && dropTarget.id === node.id) {
                          ctx.shadowColor = '#22c55e';
                          ctx.shadowBlur = 30 / globalScale;
                          ctx.strokeStyle = '#22c55e';
                          ctx.lineWidth = 4 / globalScale;
                          ctx.beginPath();
                          ctx.arc(x, y, visualRadius + 8, 0, 2 * Math.PI);
                          ctx.stroke();
                      }

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
                linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const start = link.source;
                    const end = link.target;
                    
                    if (typeof start.x !== 'number' || typeof start.y !== 'number' || 
                        typeof end.x !== 'number' || typeof end.y !== 'number') {
                        return;
                    }

                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                    ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
                    ctx.lineWidth = 1.5 / globalScale;
                    ctx.stroke();

                    // Draw preview line if dragging
                    if (dropTarget && draggedNodeRef.current) {
                        ctx.beginPath();
                        ctx.moveTo(draggedNodeRef.current.x, draggedNodeRef.current.y);
                        ctx.lineTo(dropTarget.x, dropTarget.y);
                        ctx.strokeStyle = '#22c55e';
                        ctx.lineWidth = 3 / globalScale;
                        ctx.setLineDash([10 / globalScale, 5 / globalScale]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                    ctx.restore();
                }}
                linkCanvasObjectMode={() => 'replace'}
                onNodeClick={handleNodeClick}
                backgroundColor="transparent"
                warmupTicks={100}
                cooldownTicks={0}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                enableNodeDrag={true}
                onNodeDrag={(node: any) => {
                    dragFlagRef.current = true;
                    
                    if (!draggedNodeRef.current) return;

                    // Find closest folder node
                    let closestNode: any = null;
                    let minDistance = 100;

                    const allNodes = graphRef.current?.graphData()?.nodes || [];
                    allNodes.forEach((n: any) => {
                        if (n.id === draggedNodeRef.current.id) return;
                        if (n.type !== 'folder') return;
                        
                        const dx = n.x - node.x;
                        const dy = n.y - node.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < minDistance) {
                            minDistance = distance;
                            closestNode = n;
                        }
                    });

                    setDropTarget(closestNode);
                }}
                onNodeDragStart={(node: any) => {
                    dragFlagRef.current = true;
                    draggedNodeRef.current = node;
                    setDropTarget(null);
                }}
                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
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
                    setTimeout(() => {
                        dragFlagRef.current = false;
                    }, 100);

                    if (node && draggedNodeRef.current) {
                        node.fx = node.x;
                        node.fy = node.y;

                        const draggedNode = draggedNodeRef.current;

                        // Use dropTarget if available
                        if (dropTarget && dropTarget.type === 'folder') {
                            if (draggedNode.type === 'note' && onMoveNote) {
                                onMoveNote(draggedNode.id, dropTarget.id);
                            } else if (draggedNode.type === 'folder' && onMoveFolder) {
                                if (dropTarget.id !== draggedNode.id) {
                                    onMoveFolder(draggedNode.id, dropTarget.id);
                                }
                            }
                        } else {
                            // Dropped to empty space - move to root
                            if (draggedNode.type === 'note' && onMoveNote) {
                                onMoveNote(draggedNode.id, null);
                            } else if (draggedNode.type === 'folder' && onMoveFolder) {
                                onMoveFolder(draggedNode.id, null);
                            }
                        }
                    }
                    draggedNodeRef.current = null;
                    setDropTarget(null);
                }}
            />
        </div>
    );
}
