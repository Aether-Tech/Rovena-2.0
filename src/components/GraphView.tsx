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
    const [hoverTarget, setHoverTarget] = useState<{node: any, x: number, y: number} | null>(null);

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
                      // Draw default links (existing connections)
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

                      // Find closest folder node while dragging
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

                      if (closestNode) {
                          setHoverTarget({ node: closestNode, x: node.x, y: node.y });
                      } else {
                          setHoverTarget(null);
                      }
                  }}
                  onNodeDragStart={(node: any) => {
                      dragFlagRef.current = true;
                      draggedNodeRef.current = node;
                      setHoverTarget(null);
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
                      setTimeout(() => {
                          dragFlagRef.current = false;
                      }, 100);

                      if (node && draggedNodeRef.current) {
                          node.fx = node.x;
                          node.fy = node.y;

                          // Find the closest node to drop on
                          const draggedNode = draggedNodeRef.current;
                          let closestNode: any = null;
                          let minDistance = 80; // Maximum drop distance

                          graphData.nodes.forEach((n: any) => {
                              if (n.id === draggedNode.id) return;
                              
                              const dx = n.x - node.x;
                              const dy = n.y - node.y;
                              const distance = Math.sqrt(dx * dx + dy * dy);

                              if (distance < minDistance) {
                                  minDistance = distance;
                                  closestNode = n;
                              }
                          });

                          // Handle the drop
                          if (closestNode && closestNode.type === 'folder') {
                              if (draggedNode.type === 'note' && onMoveNote) {
                                  onMoveNote(draggedNode.id, closestNode.id);
                              } else if (draggedNode.type === 'folder' && onMoveFolder) {
                                  // Prevent circular references
                                  if (closestNode.id !== draggedNode.id) {
                                      onMoveFolder(draggedNode.id, closestNode.id);
                                  }
                              }
                          } else if (!closestNode) {
                              // Dropped to empty space - move to root
                              if (draggedNode.type === 'note' && onMoveNote) {
                                  onMoveNote(draggedNode.id, null);
                              } else if (draggedNode.type === 'folder' && onMoveFolder) {
                                  onMoveFolder(draggedNode.id, null);
                              }
                          }
                      }
                      draggedNodeRef.current = null;
                      setHoverTarget(null);
                  }}
              />
              {hoverTarget && (
                  <svg
                      style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          pointerEvents: 'none',
                          zIndex: 10,
                      }}
                  >
                      <defs>
                          <filter id="preview-glow">
                              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                              <feMerge>
                                  <feMergeNode in="coloredBlur"/>
                                  <feMergeNode in="SourceGraphic"/>
                              </feMerge>
                          </filter>
                      </defs>
                      {(() => {
                          const graph = graphRef.current;
                          if (!graph) return null;

                          const { k: zoom, x: translateX, y: translateY } = graph.zoom() || { k: 1, x: 0, y: 0 };

                          const targetScreenX = hoverTarget.node.x * zoom + translateX + dimensions.width / 2;
                          const targetScreenY = hoverTarget.node.y * zoom + translateY + dimensions.height / 2;
                          const dragScreenX = hoverTarget.x * zoom + translateX + dimensions.width / 2;
                          const dragScreenY = hoverTarget.y * zoom + translateY + dimensions.height / 2;

                          return (
                              <line
                                  x1={dragScreenX}
                                  y1={dragScreenY}
                                  x2={targetScreenX}
                                  y2={targetScreenY}
                                  stroke="#22c55e"
                                  strokeWidth="4"
                                  strokeDasharray="10,5"
                                  strokeLinecap="round"
                                  filter="url(#preview-glow)"
                                  opacity="0.9"
                              />
                          );
                      })()}
                  </svg>
              )}
          </div>
      );
  }
