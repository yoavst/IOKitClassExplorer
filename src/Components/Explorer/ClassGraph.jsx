import React, { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Minimize, Eye, EyeOff, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function ClassGraph({ classes, onNodeClick, selectedClass }) {
    const canvasRef = useRef(null)
    const nodesRef = useRef({})
    const containerRef = useRef(null)
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 800 })
    const [hoveredNode, setHoveredNode] = useState(null)
    const [filterMode, setFilterMode] = useState(true)

    useEffect(() => {
        if (!classes.length || !containerRef.current) return

        const resizeCanvas = () => {
            const container = containerRef.current
            setCanvasSize({
                width: container.offsetWidth * 2, // Make canvas larger for panning
                height: container.offsetHeight * 2,
            })
        }

        resizeCanvas()
        window.addEventListener('resize', resizeCanvas)
        return () => window.removeEventListener('resize', resizeCanvas)
    }, [classes])

    useEffect(() => {
        if (!classes.length || !canvasRef.current) return

        // Reset on new data or selected class change
        drawGraph()
    }, [classes, zoom, pan, canvasSize, selectedClass, hoveredNode, filterMode])

    // Get all ancestor classes (inheritance chain) for a given class
    const getAncestorClasses = (className, result = new Set()) => {
        const cls = classes.find((c) => c.name === className)
        if (!cls || !cls.parent_classes || cls.parent_classes.length === 0) return result

        for (const parentName of cls.parent_classes) {
            result.add(parentName)
            getAncestorClasses(parentName, result)
        }

        return result
    }

    // Get all descendant classes (all children recursively) for a given class
    const getDescendantClasses = (className, result = new Set()) => {
        const children = classes.filter(
            (c) => c.parent_classes && c.parent_classes.includes(className)
        )

        if (children.length === 0) return result

        for (const child of children) {
            result.add(child.name)
            getDescendantClasses(child.name, result)
        }

        return result
    }

    // Get visible nodes - either all nodes or filtered based on selection
    const getVisibleNodes = () => {
        if (!filterMode || !selectedClass) return classes

        // When filtered, show:
        // 1. The selected class
        // 2. All its ancestors (inheritance chain to root)
        // 3. All its descendants (children recursively)

        const visibleNames = new Set([selectedClass.name])

        // Add ancestors
        getAncestorClasses(selectedClass.name, visibleNames)

        // Add descendants
        getDescendantClasses(selectedClass.name, visibleNames)

        return classes.filter((cls) => visibleNames.has(cls.name))
    }

    const drawGraph = () => {
        nodesRef.current = {}

        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height)

        // Set canvas transform for zoom and pan
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.setTransform(zoom, 0, 0, zoom, pan.x, pan.y)

        // Config
        const nodeWidth = 150
        const nodeHeight = 40
        const verticalSpacing = 100

        // Get visible nodes based on filter mode
        const visibleNodes = getVisibleNodes()

        // Calculate inheritance depth for each class
        const getDepth = (className, visited = new Set()) => {
            if (visited.has(className)) return 0
            visited.add(className)

            const cls = classes.find((c) => c.name === className)
            if (!cls || !cls.parent_classes || cls.parent_classes.length === 0) return 0

            return (
                1 +
                Math.max(
                    ...cls.parent_classes.map((parent) => getDepth(parent, new Set([...visited])))
                )
            )
        }

        // Calculate levels - group classes by their inheritance depth
        const levels = {}
        visibleNodes.forEach((cls) => {
            const depth = getDepth(cls.name)
            if (!levels[depth]) levels[depth] = []
            levels[depth].push(cls)
        })

        // Position nodes by level
        Object.entries(levels).forEach(([depth, levelClasses]) => {
            const y = Number(depth) * verticalSpacing + 50
            const levelWidth = levelClasses.length * (nodeWidth + 30)
            const startX = (canvasSize.width / zoom - levelWidth) / 2

            levelClasses.forEach((cls, index) => {
                const x = startX + index * (nodeWidth + 30)
                nodesRef.current[cls.name] = { x, y, width: nodeWidth, height: nodeHeight }
            })
        })

        // Draw connections (edges)
        visibleNodes.forEach((cls) => {
            const childNode = nodesRef.current[cls.name]
            if (!childNode) return

            ;(cls.parent_classes || []).forEach((parentName) => {
                // Skip connections to nodes that aren't visible
                if (!nodesRef.current[parentName]) return

                const parentNode = nodesRef.current[parentName]

                // Highlight connections if selected node
                if (
                    selectedClass &&
                    (selectedClass.name === cls.name || selectedClass.name === parentName)
                ) {
                    context.strokeStyle = '#3B82F6' // Blue for selected node connections
                    context.lineWidth = 3
                } else {
                    context.strokeStyle =
                        getComputedStyle(document.documentElement)
                            .getPropertyValue('--slate-500')
                            .trim() || '#6B7280'
                    context.lineWidth = 2
                }

                context.beginPath()
                context.moveTo(childNode.x + nodeWidth / 2, childNode.y)
                context.lineTo(parentNode.x + nodeWidth / 2, parentNode.y + nodeHeight)
                context.stroke()

                // Draw arrow
                const arrowSize = 6
                const arrowX = parentNode.x + nodeWidth / 2
                const arrowY = parentNode.y + nodeHeight

                context.beginPath()
                context.moveTo(arrowX - arrowSize, arrowY - arrowSize)
                context.lineTo(arrowX, arrowY)
                context.lineTo(arrowX + arrowSize, arrowY - arrowSize)
                context.stroke()
            })
        })

        // Draw nodes
        context.font = 'bold 14px Arial'
        context.textAlign = 'center'
        context.textBaseline = 'middle'

        Object.entries(nodesRef.current).forEach(([className, node]) => {
            const isSelected = selectedClass?.name === className
            const isHovered = hoveredNode === className
            const isDarkMode = document.documentElement.classList.contains('dark')

            // Node background
            if (isSelected) {
                context.fillStyle = isDarkMode ? '#1D4ED8' : '#3B82F6'
                context.strokeStyle = isDarkMode ? '#60A5FA' : '#2563EB'
                context.lineWidth = 3
            } else if (isHovered) {
                context.fillStyle = isDarkMode ? '#4B5563' : '#F3F4F6'
                context.strokeStyle = isDarkMode ? '#9CA3AF' : '#D1D5DB'
                context.lineWidth = 2.5
            } else {
                context.fillStyle = isDarkMode ? '#374151' : '#FFFFFF'
                context.strokeStyle = isDarkMode ? '#4B5563' : '#E2E8F0'
                context.lineWidth = 2
            }

            // Draw node with rounded corners
            context.beginPath()
            context.roundRect(node.x, node.y, node.width, node.height, 8)
            context.fill()
            context.stroke()

            // Node text
            context.fillStyle = isSelected ? '#FFFFFF' : isDarkMode ? '#E5E7EB' : '#000000'
            context.fillText(className, node.x + node.width / 2, node.y + node.height / 2)

            // Draw clickable indicator
            if (isHovered && !isSelected) {
                context.fillStyle = isDarkMode ? '#60A5FA' : '#3B82F6'
                context.beginPath()
                context.arc(node.x + node.width - 10, node.y + 10, 4, 0, Math.PI * 2)
                context.fill()
            }
        })
    }

    const getNodeUnderCursor = (clientX, clientY) => {
        const rect = canvasRef.current.getBoundingClientRect()
        const x = (clientX - rect.left) / zoom - pan.x / zoom
        const y = (clientY - rect.top) / zoom - pan.y / zoom

        for (const [className, node] of Object.entries(nodesRef.current)) {
            if (
                x >= node.x &&
                x <= node.x + node.width &&
                y >= node.y &&
                y <= node.y + node.height
            ) {
                return className
            }
        }

        return null
    }

    const handleCanvasClick = (e) => {
        if (isDragging) return

        const nodeName = getNodeUnderCursor(e.clientX, e.clientY)
        if (nodeName) {
            const clickedClass = classes.find((c) => c.name === nodeName)
            if (clickedClass) onNodeClick(clickedClass)
        }
    }

    const handleMouseDown = (e) => {
        // Check if we're clicking on a node
        const nodeName = getNodeUnderCursor(e.clientX, e.clientY)

        // If not on a node, start dragging
        if (!nodeName) {
            setIsDragging(true)
            setDragStart({
                x: e.clientX - pan.x,
                y: e.clientY - pan.y,
            })
        }
    }

    const handleMouseMove = (e) => {
        if (isDragging) {
            setPan({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            })
        } else {
            // Update hovered node
            const nodeName = getNodeUnderCursor(e.clientX, e.clientY)
            setHoveredNode(nodeName)

            // Update cursor based on whether hovering over a node
            if (canvasRef.current) {
                canvasRef.current.style.cursor = nodeName ? 'pointer' : 'move'
            }
        }
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const handleZoomIn = () => {
        setZoom((prev) => Math.min(prev * 1.2, 3))
    }

    const handleZoomOut = () => {
        setZoom((prev) => Math.max(prev / 1.2, 0.3))
    }

    const handleReset = () => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }

    const handleWheel = (e) => {
        e.preventDefault()

        // Get mouse position relative to canvas
        const rect = canvasRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // Calculate zoom factor
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
        const newZoom = Math.max(0.3, Math.min(3, zoom * zoomFactor))

        // Adjust pan to zoom toward mouse position
        const newPan = {
            x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
            y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
        }

        setZoom(newZoom)
        setPan(newPan)
    }

    const toggleFilterMode = () => {
        setFilterMode(!filterMode)
        // Reset view when toggling filter
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }

    const exportToMermaid = () => {
        // Get visible nodes
        const visibleNodes = getVisibleNodes()

        // Create Mermaid diagram
        let mermaidCode = 'classDiagram\n'

        // Add inheritance relationships
        visibleNodes.forEach((cls) => {
            ;(cls.parent_classes || []).forEach((parentName) => {
                // Only include the relationship if both classes are visible
                if (visibleNodes.some((node) => node.name === parentName)) {
                    // In Mermaid, the arrow points from parent to child (opposite of our visual)
                    mermaidCode += `    ${parentName} <|-- ${cls.name}\n`
                }
            })

            // Add properties as class members
            if (cls.properties && Object.keys(cls.properties).length > 0) {
                mermaidCode += `    class ${cls.name} {\n`

                // Add properties
                for (const [key, value] of Object.entries(cls.properties)) {
                    // Handle different property types
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
    }

    return (
        <div className="h-full flex flex-col relative" ref={containerRef}>
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={handleZoomIn}
                                className="h-8 w-8 rounded-full shadow-md dark:bg-gray-700"
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Zoom in</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={handleZoomOut}
                                className="h-8 w-8 rounded-full shadow-md dark:bg-gray-700"
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Zoom out</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={handleReset}
                                className="h-8 w-8 rounded-full shadow-md dark:bg-gray-700"
                            >
                                <Minimize className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Reset view</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={filterMode ? 'outline' : 'secondary'}
                                size="icon"
                                onClick={toggleFilterMode}
                                className={`h-8 w-8 rounded-full shadow-md 
                  ${
                      filterMode
                          ? 'bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-blue-700'
                          : 'dark:bg-gray-700'
                  }`}
                            >
                                {filterMode ? (
                                    <EyeOff className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{filterMode ? 'Show all nodes' : 'Filter inheritance chain'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={exportToMermaid}
                                className="h-8 w-8 rounded-full shadow-md bg-blue-600 hover:bg-blue-700"
                            >
                                <Download className="h-4 w-4 text-white" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Export to Mermaid diagram</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg">
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    onClick={handleCanvasClick}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => {
                        handleMouseUp()
                        setHoveredNode(null)
                    }}
                    onWheel={handleWheel}
                    className="w-full h-full"
                    style={{ touchAction: 'none' }}
                />
            </div>
        </div>
    )
}
