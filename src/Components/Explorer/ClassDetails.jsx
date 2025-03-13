import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowUpRight, GitBranchPlus, ArrowRight } from 'lucide-react'
import { getDirectChildren, getChildren, getParents } from '../../utils/hierarchy'

// Custom JSON renderer component
const JsonView = ({ data, level = 0 }) => {
    if (data === null || data === undefined)
        return <span className="text-gray-500 dark:text-gray-400">null</span>

    if (typeof data !== 'object') {
        // Render primitives
        if (typeof data === 'string')
            return <span className="text-green-600 dark:text-green-400">"{data}"</span>
        if (typeof data === 'number')
            return <span className="text-blue-600 dark:text-blue-400">{data}</span>
        if (typeof data === 'boolean')
            return <span className="text-purple-600 dark:text-purple-400">{data.toString()}</span>
        return <span>{String(data)}</span>
    }

    // For arrays and objects
    const isArray = Array.isArray(data)
    const isEmpty = Object.keys(data).length === 0

    if (isEmpty) {
        return <span>{isArray ? '[]' : '{}'}</span>
    }

    return (
        <div className="font-mono text-sm">
            <div>{isArray ? '[' : '{'}</div>
            {Object.entries(data).map(([key, value], index) => (
                <div key={key} className="ml-4">
                    {!isArray && <span className="text-red-600 dark:text-red-400">{key}</span>}
                    {!isArray && <span>: </span>}
                    <JsonView data={value} level={level + 1} />
                    {index < Object.keys(data).length - 1 && <span>,</span>}
                </div>
            ))}
            <div>{isArray ? ']' : '}'}</div>
        </div>
    )
}

export default function ClassDetails({ selectedClass, setSelectedClass, allClasses }) {
    if (!selectedClass) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                Select a class to view details
            </div>
        )
    }

    // FIXME: use memo
    const directChildren = getDirectChildren(allClasses, selectedClass.name)
    const indirectChildren = getChildren(allClasses, selectedClass.name).filter(
        (child) => !directChildren.includes(child)
    )
    const parents = getParents(allClasses, selectedClass.name)

    const hasMoreDirectChildren = directChildren.length > 10
    const hasMoreIndirectChildren = indirectChildren.length > 10

    const displayedDirectChildren = hasMoreDirectChildren
        ? directChildren.slice(0, 10)
        : directChildren

    const displayedIndirectChildren = hasMoreIndirectChildren
        ? indirectChildren.slice(0, 10)
        : indirectChildren

    const handleShowMoreChildren = () => {
        const childrenQuery = `children: ${selectedClass.name}`
        onSearchChange(childrenQuery)
    }

    const onSearchChange = (query) => {
        // Apply the search directly
        const searchInput = document.querySelector('input[placeholder="Search classes"]')
        if (searchInput) {
            searchInput.value = query

            // Create and dispatch events to trigger the search
            const inputEvent = new Event('input', { bubbles: true })
            searchInput.dispatchEvent(inputEvent)

            const keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
            searchInput.dispatchEvent(keyEvent)
        }
    }

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4 dark:text-white">{selectedClass.name}</h2>

            <div className="space-y-5">
                {/* Inheritance Chain */}
                <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1 text-gray-700 dark:text-gray-300">
                        <GitBranchPlus className="w-4 h-4" />
                        Inheritance Chain
                    </h3>
                    <div className="space-y-1 ml-1">
                        {parents.map((cls, index) => (
                            <div key={cls.name} className="flex items-center">
                                {index > 0 && (
                                    <div className="w-5 h-5 flex items-center justify-center dark:text-gray-400">
                                        ↑
                                    </div>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-2 h-6"
                                    onClick={() => setSelectedClass(cls)}
                                >
                                    {cls.name}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Child Classes Section */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Children{' '}
                            {directChildren.length + indirectChildren.length > 0 &&
                                `(${directChildren.length + indirectChildren.length})`}
                        </h3>
                    </div>

                    {directChildren.length === 0 && indirectChildren.length === 0 ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400">No children</div>
                    ) : (
                        <>
                            {/* Direct Children */}
                            <div className="mb-3">
                                <h4 className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center">
                                    <ArrowRight className="h-3 w-3 mr-1" />
                                    Direct Children{' '}
                                    {directChildren.length > 0 && `(${directChildren.length})`}
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {displayedDirectChildren.map((child) => (
                                        <Badge
                                            key={child.name}
                                            variant="secondary"
                                            className="cursor-pointer hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs"
                                            onClick={() => setSelectedClass(child)}
                                        >
                                            {child.name}
                                            <ArrowUpRight className="w-3 h-3 ml-1" />
                                        </Badge>
                                    ))}
                                    {hasMoreDirectChildren && (
                                        <Badge
                                            variant="outline"
                                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
                                            onClick={handleShowMoreChildren}
                                        >
                                            ...and {directChildren.length - 10} more
                                        </Badge>
                                    )}
                                    {displayedDirectChildren.length === 0 && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            No direct children
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Indirect Children */}
                            {indirectChildren.length > 0 && (
                                <div>
                                    <h4 className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center">
                                        <ArrowRight className="h-3 w-3 mr-1" />
                                        Indirect Children{' '}
                                        {indirectChildren.length > 0 &&
                                            `(${indirectChildren.length})`}
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {displayedIndirectChildren.map((child) => (
                                            <Badge
                                                key={child.name}
                                                variant="secondary"
                                                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
                                                onClick={() => setSelectedClass(child)}
                                            >
                                                {child.name}
                                                <ArrowUpRight className="w-3 h-3 ml-1" />
                                            </Badge>
                                        ))}
                                        {hasMoreIndirectChildren && (
                                            <Badge
                                                variant="outline"
                                                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
                                                onClick={handleShowMoreChildren}
                                            >
                                                ...and {indirectChildren.length - 10} more
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Properties */}
                <div>
                    <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                        Properties
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 overflow-auto text-xs max-h-96 dark:text-gray-200 border dark:border-gray-700">
                        <JsonView data={selectedClass.properties || {}} />
                    </div>
                </div>
            </div>
        </div>
    )
}
