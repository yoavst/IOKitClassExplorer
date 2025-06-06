import Dagre from '@dagrejs/dagre'

interface LayoutOptions {
    direction: 'TB' | 'BT' | 'LR' | 'RL'
}

const nodeWidth = 172
const nodeHeight = 36

export function layout<
    Node extends { id: string; measured?: { width: number; height: number } },
    Edge extends { source: string; target: string },
>(
    nodes: Node[],
    edges: Edge[],
    options: LayoutOptions = { direction: 'BT' }
): { nodes: (Node & { position: { x: number; y: number } })[]; edges: Edge[] } {
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: options.direction })

    edges.forEach((edge) => g.setEdge(edge.source, edge.target))
    nodes.forEach((node) => g.setNode(node.id, { width: nodeWidth, height: nodeHeight }))

    Dagre.layout(g)

    return {
        nodes: nodes.map((node) => {
            const position = g.node(node.id)
            // We are shifting the dagre node position (anchor=center center) to the top left
            // so it matches the React Flow node anchor point (top left).
            const x = position.x - (node.measured?.width ?? 0) / 2
            const y = position.y - (node.measured?.height ?? 0) / 2

            return { ...node, position: { x, y } }
        }),
        edges,
    }
}
