import { DirectedGraph } from 'graphology'
import { subgraph } from 'graphology-operators'

type BaseNode = {
    name: string
    parent: string | null
}

type Hierarchy<NodeType extends BaseNode> = DirectedGraph<NodeType>

export function createHierarchy<NodeType extends BaseNode>(nodes: NodeType[]): Hierarchy<NodeType> {
    const graph = new DirectedGraph<NodeType>()
    nodes.forEach((node) => {
        graph.addNode(node.name, node)
    })
    nodes.forEach((node) => {
        if (node.parent) {
            graph.addDirectedEdge(node.name, node.parent)
        }
    })
    return graph
}

export function getParents<NodeType extends BaseNode>(
    graph: Hierarchy<NodeType>,
    node: string
): NodeType[] {
    const parents: NodeType[] = []
    function findParents(currentNode: string) {
        graph.forEachOutNeighbor(currentNode, (parent) => {
            const parentNode = graph.getNodeAttributes(parent)
            parents.push(parentNode)
            findParents(parent)
        })
    }
    findParents(node)
    return parents
}

export function getDirectChildren<NodeType extends BaseNode>(    
    graph: Hierarchy<NodeType>,
    node: string
): NodeType[] {
    return graph.inNeighbors(node).map((child) => graph.getNodeAttributes(child))
}

export function getChildren<NodeType extends BaseNode>(
    graph: Hierarchy<NodeType>,
    node: string
): NodeType[] {
    const children: NodeType[] = []
    function findChildren(currentNode: string) {
        graph.forEachInNeighbor(currentNode, (child) => {
            const childrenNode = graph.getNodeAttributes(child)
            children.push(childrenNode)
            findChildren(child)
        })
    }
    findChildren(node)
    return children
}

export function getSubgraph<NodeType extends BaseNode>(
    graph: Hierarchy<NodeType>,
    nodes: NodeType[]
): Hierarchy<NodeType> {
    return subgraph(
        graph,
        nodes.map((node) => node.name)
    )
}

export function getEdges<NodeType extends BaseNode>(
    graph: Hierarchy<NodeType>
): [source: string, target: string][] {
    return [...graph.edgeEntries()].map(({ source, target }) => [source, target])
}

export function getNodes<NodeType extends BaseNode>(graph: Hierarchy<NodeType>): NodeType[] {
    return graph.nodes().map((node) => graph.getNodeAttributes(node))
}

export function getNode<NodeType extends BaseNode>(
    graph: Hierarchy<NodeType>,
    node: string
): NodeType {
    return graph.getNodeAttributes(node)
}
