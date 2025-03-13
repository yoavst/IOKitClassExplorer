import React, { useState, useCallback, useMemo, useLayoutEffect } from 'react'
import {
    ReactFlow,
    Background,
    Panel,
    Position,
    Handle,
    ReactFlowProvider,
    useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Download, Eye, EyeOff, ZoomOut, ZoomIn, Minimize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    getParents,
    getChildren,
    getSubgraph,
    getNodes,
    getEdges,
    getNode,
} from '../../utils/hierarchy.ts'
import { layout } from '../../utils/graphLayout.ts'

// Custom node component for class nodes
const ClassNode = ({ data }) => {
    return (
        <div
            className={`px-4 py-2 rounded-md font-medium shadow-md border transition-colors ${
                data.isSelected
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-gray-800 text-gray-100 border-gray-700 hover:bg-gray-700'
            }`}
        >
            <Handle
                type="source"
                position={Position.Top}
                isConnectable={false}
                style={{ visibility: 'hidden' }}
            />
            <Handle
                type="target"
                position={Position.Bottom}
                isConnectable={false}
                style={{ visibility: 'hidden' }}
            />
            {data.label}
        </div>
    )
}

const GraphButton = ({
    onClick,
    // eslint-disable-next-line no-unused-vars
    Icon,
    color = 'bg-blue-600 hover:bg-blue-700',
    variant = 'secondary',
}) => {
    return (
        <Button
            variant={variant}
            size="icon"
            onClick={onClick}
            className={`h-8 w-8 rounded-full shadow-md cursor-pointer ${color}`}
        >
            <Icon className="h-4 w-4 text-white" />
        </Button>
    )
}

// Register node types
const nodeTypes = {
    classNode: ClassNode,
}
export default function ClassGraphWrapper({ classes, setSelectedClass, selectedClass }) {
    return (
        <ReactFlowProvider>
            <ClassGraph
                classes={classes}
                setSelectedClass={setSelectedClass}
                selectedClass={selectedClass}
            />
        </ReactFlowProvider>
    )
}

function ClassGraph({ classes, setSelectedClass, selectedClass }) {
    const { zoomIn, zoomOut, fitView } = useReactFlow()
    const [shouldFilter, setShouldFilter] = useState(true)

    const visibleClassesGraph = useMemo(() => {
        if (selectedClass === null || !shouldFilter) return classes
        const parents = getParents(classes, selectedClass.name)
        const children = getChildren(classes, selectedClass.name)
        const visibleClasses = parents.concat(children).concat([selectedClass])
        return getSubgraph(classes, visibleClasses)
    }, [classes, selectedClass, shouldFilter])

    const nodes = useMemo(() => {
        return getNodes(visibleClassesGraph).map((cls) => ({
            id: cls.name,
            type: 'classNode',
            data: {
                label: cls.name,
                isSelected: selectedClass?.name === cls.name,
            },
        }))
    }, [visibleClassesGraph, selectedClass])

    const edges = useMemo(() => {
        return getEdges(visibleClassesGraph).map(([source, target]) => {
            const isSelected = selectedClass?.name === source || selectedClass?.name === target
            return {
                id: `${source}-${target}`,
                source,
                target,
                style: {
                    stroke: isSelected ? '#60a5fa' : '#4b5563',
                    strokeWidth: isSelected ? 2 : 1,
                },
            }
        })
    }, [selectedClass, visibleClassesGraph])

    useLayoutEffect(() => {
        setTimeout(() => fitView({ duration: 500 }))
    }, [selectedClass, shouldFilter, fitView])

    const { nodes: positionedNodes, edges: positionedEdges } = useMemo(
        () => layout(nodes, edges),
        [nodes, edges]
    )

    // Handle node click
    const handleNodeClick = useCallback(
        (_, node) => {
            const clickedClass = getNode(visibleClassesGraph, node.id)
            if (clickedClass) {
                setSelectedClass(clickedClass)
            }
        },
        [setSelectedClass, visibleClassesGraph]
    )

    // Export to Mermaid
    const exportToMermaid = useCallback(() => {
        const visibleNodes = getNodes(visibleClassesGraph)

        // Create Mermaid diagram
        let mermaidCode = 'classDiagram\n'

        // Add inheritance relationships
        visibleNodes.forEach((cls) => {
            if (cls.parent) {
                // Only include the relationship if both classes are visible
                if (visibleNodes.some((node) => node.name === cls.parent)) {
                    // In Mermaid, the arrow points from parent to child
                    mermaidCode += `    ${cls.parent} <|-- ${cls.name}\n`
                }
            }

            // Add properties as class members
            if (cls.properties && Object.keys(cls.properties).length > 0) {
                mermaidCode += `    class ${cls.name} {\n`

                for (const [key, value] of Object.entries(cls.properties)) {
                    // Format properties based on type
                    if (typeof value === 'boolean') {
                        mermaidCode += `        ${key}: ${value}\n`
                    } else if (typeof value === 'number') {
                        mermaidCode += `        ${key}: ${value}\n`
                    } else if (typeof value === 'string') {
                        mermaidCode += `        ${key}: "${value}"\n`
                    } else if (Array.isArray(value)) {
                        mermaidCode += `        ${key}: [${value.join(', ')}]\n`
                    } else if (typeof value === 'object') {
                        mermaidCode += `        ${key}: Object\n`
                    }
                }

                mermaidCode += '    }\n'
            }
        })

        // Create a blob and download the file
        const blob = new Blob([mermaidCode], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'class_diagram.mmd'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, [visibleClassesGraph])

    return (
        <div className="w-full h-full bg-gray-900" style={{ height: '100%' }}>
            <ReactFlow
                nodes={positionedNodes}
                edges={positionedEdges}
                nodeTypes={nodeTypes}
                onNodeClick={handleNodeClick}
                maxZoom={3}
                minZoom={0.1}
                fitView
            >
                <Background variant="dots" gap={16} size={1} color="#334155" />
                <Panel position="top-right" className="flex flex-col gap-2">
                    <GraphButton
                        onClick={() => setShouldFilter((shouldFilter) => !shouldFilter)}
                        Icon={shouldFilter ? EyeOff : Eye}
                        color={shouldFilter ? 'bg-blue-900 border-blue-700' : 'bg-gray-700'}
                        variant={shouldFilter ? 'outline' : 'secondary'}
                    />
                    <GraphButton onClick={zoomIn} Icon={ZoomIn} />
                    <GraphButton onClick={zoomOut} Icon={ZoomOut} />
                    <GraphButton onClick={fitView} Icon={Minimize} />
                    <GraphButton onClick={exportToMermaid} Icon={Download} />
                </Panel>
            </ReactFlow>
        </div>
    )
}
