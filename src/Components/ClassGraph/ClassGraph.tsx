import { useState, useCallback, useMemo, useLayoutEffect, FC, useRef } from 'react'
import {
    ReactFlow,
    Background,
    Panel,
    Position,
    Handle,
    ReactFlowProvider,
    useReactFlow,
    BackgroundVariant,
    type Node,
    type NodeTypes,
    type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
    Download,
    Eye,
    EyeOff,
    ZoomOut,
    ZoomIn,
    Minimize,
    LucideProps,
    AlignCenter,
} from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import { Class } from '../../utils/types.tsx'
import {
    getParents,
    getChildren,
    getSubgraph,
    getNodes,
    getEdges,
    getNode,
    Hierarchy,
} from '../../utils/hierarchy.ts'
import { layout } from '../../utils/graphLayout.ts'

type ClassNodeType = Node<
    {
        isSelected: boolean
        label: string
    },
    'classNode'
>

const ClassNode: FC<NodeProps<ClassNodeType>> = ({ data: { isSelected, label } }) => {
    return (
        <div
            className={`px-4 py-2 rounded-md font-medium shadow-md border transition-colors ${
                isSelected
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
            {label}
        </div>
    )
}

interface GraphButtonProps {
    onClick: () => void
    Icon: FC<LucideProps>
    color?: string
    variant?: 'secondary' | 'outline'
}

const GraphButton: FC<GraphButtonProps> = ({
    onClick,
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

const nodeTypes: NodeTypes = {
    classNode: ClassNode,
}

interface ClassGraphProps {
    classes: Hierarchy<Class>
    setSelectedClass: (cls: Class) => void
    selectedClass: Class | null
}

const ClassGraphWrapper: FC<ClassGraphProps> = ({ classes, setSelectedClass, selectedClass }) => {
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

const ClassGraph: FC<ClassGraphProps> = ({ classes, setSelectedClass, selectedClass }) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow()
    const [shouldFilter, setShouldFilter] = useState(true)
    const flowWrapperRef = useRef<HTMLDivElement | null>(null)

    const visibleClassesGraph = useMemo(() => {
        if (selectedClass === null || !shouldFilter) return classes
        const parents = getParents(classes, selectedClass.name)
        let children = getChildren(classes, selectedClass.name)
        if (children.length > 50) {
            children = children.slice(0, 50)
        }
        const visibleClasses = parents.concat(children).concat([selectedClass])
        return getSubgraph(classes, visibleClasses)
    }, [classes, selectedClass, shouldFilter])

    const nodes: Omit<ClassNodeType, 'measured' | 'position'>[] = useMemo(() => {
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
        setTimeout(() => void fitView({ duration: 500 }))
    }, [selectedClass, shouldFilter, fitView])

    const { nodes: positionedNodes, edges: positionedEdges } = useMemo(
        () => layout(nodes, edges),
        [nodes, edges]
    )

    const toggleFullscreen = async () => {
        if (!document.fullscreenElement) {
            await flowWrapperRef.current?.requestFullscreen()
        } else {
            await document.exitFullscreen()
        }
    }

    const handleNodeClick = useCallback(
        (_: unknown, node: ClassNodeType) => {
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
            if (cls.properties && Object.keys(cls.properties as object).length > 0) {
                mermaidCode += `    class ${cls.name} {\n`

                for (const [key, value] of Object.entries(cls.properties as object)) {
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
        <div className="w-full h-full bg-gray-900" style={{ height: '100%' }} ref={flowWrapperRef}>
            <ReactFlow
                nodes={positionedNodes}
                edges={positionedEdges}
                nodeTypes={nodeTypes}
                onNodeClick={handleNodeClick}
                maxZoom={3}
                minZoom={0.1}
                fitView
            >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
                <Panel position="top-right" className="flex flex-col gap-2">
                    <GraphButton
                        onClick={() => {
                            setShouldFilter((shouldFilter) => !shouldFilter)
                        }}
                        Icon={shouldFilter ? EyeOff : Eye}
                        color={shouldFilter ? 'bg-blue-900 border-blue-700' : 'bg-gray-700'}
                        variant={shouldFilter ? 'outline' : 'secondary'}
                    />
                    <GraphButton onClick={() => void zoomIn()} Icon={ZoomIn} />
                    <GraphButton onClick={() => void zoomOut()} Icon={ZoomOut} />
                    <GraphButton onClick={() => void toggleFullscreen()} Icon={Minimize} />
                    <GraphButton onClick={() => void fitView()} Icon={AlignCenter} />
                    <GraphButton onClick={exportToMermaid} Icon={Download} />
                </Panel>
            </ReactFlow>
        </div>
    )
}

export default ClassGraphWrapper
