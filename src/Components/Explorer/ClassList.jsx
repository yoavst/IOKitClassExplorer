import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Search, X } from 'lucide-react'

export default function ClassList({
    classes,
    selectedClass,
    setSelectedClass,
    searchQuery,
    setSearchQuery,
}) {
    const [searchType, setSearchType] = useState('normal') // 'normal', 'parents', 'children'
    const [relationClassName, setRelationClassName] = useState('')
    const [inputValue, setInputValue] = useState(searchQuery || '')

    // Parse special search queries
    useEffect(() => {
        if (searchQuery && typeof searchQuery === 'string') {
            if (searchQuery.startsWith('parents:')) {
                const targetClass = searchQuery.slice(8).trim()
                setSearchType('parents')
                setRelationClassName(targetClass)
            } else if (searchQuery.startsWith('children:')) {
                const targetClass = searchQuery.slice(9).trim()
                setSearchType('children')
                setRelationClassName(targetClass)
            } else {
                setSearchType('normal')
                setRelationClassName('')
            }

            setInputValue(searchQuery)
        } else {
            setSearchType('normal')
            setRelationClassName('')
            setInputValue('')
        }
    }, [searchQuery])

    const getFilteredClasses = () => {
        if (searchType === 'parents') {
            const targetClass = classes.find(
                (c) => c.name.toLowerCase() === relationClassName.toLowerCase()
            )
            if (!targetClass || !targetClass.parent_classes) return []
            return classes.filter((c) => targetClass.parent_classes.includes(c.name))
        }

        if (searchType === 'children') {
            // Get all descendants recursively
            const getAllDescendants = (className, result = new Set()) => {
                const directChildren = classes.filter(
                    (c) => c.parent_classes && c.parent_classes.includes(className)
                )

                directChildren.forEach((child) => {
                    result.add(child.name)
                    getAllDescendants(child.name, result)
                })

                return result
            }

            const descendantNames = getAllDescendants(relationClassName)
            return classes.filter((c) => descendantNames.has(c.name))
        }

        // Normal text/regex search - ensure unique results
        if (!searchQuery) {
            // Return all unique classes when no search
            return [...new Map(classes.map((item) => [item.name, item])).values()]
        }

        try {
            const regex = new RegExp(searchQuery, 'i')
            return [
                ...new Map(
                    classes.filter((c) => regex.test(c.name)).map((item) => [item.name, item])
                ).values(),
            ]
        } catch {
            return [
                ...new Map(
                    classes
                        .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((item) => [item.name, item])
                ).values(),
            ]
        }
    }

    const handleClearSpecialSearch = () => {
        setSearchQuery('')
        setInputValue('')
    }

    const handleParentsSearch = (className) => {
        const query = `parents: ${className}`
        setSearchQuery(query)
        setInputValue(query)
    }

    const handleChildrenSearch = (className) => {
        const query = `children: ${className}`
        setSearchQuery(query)
        setInputValue(query)
    }

    // Get filtered and deduplicated classes
    const filteredClasses = getFilteredClasses()

    return (
        <div className="w-full h-full flex flex-col">
            <div className="p-2 border-b dark:border-gray-700">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />

                    <Input
                        placeholder="Search classes"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setSearchQuery(inputValue)
                            }
                        }}
                        onBlur={() => {
                            if (inputValue !== searchQuery) {
                                setSearchQuery(inputValue)
                            }
                        }}
                        className="pl-8 pr-10 text-sm h-9 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />

                    {(searchType === 'parents' || searchType === 'children' || searchQuery) && (
                        <button
                            className="absolute right-2 top-2.5 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                            onClick={handleClearSpecialSearch}
                        >
                            <X className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap gap-1 mt-2">
                    <Badge
                        onClick={() => handleParentsSearch('Animal')}
                        className="text-xs py-0 px-1.5 cursor-pointer bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                        parents: Animal
                    </Badge>
                    <Badge
                        onClick={() => handleChildrenSearch('Mammal')}
                        className="text-xs py-0 px-1.5 cursor-pointer bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                    >
                        children: Mammal
                    </Badge>
                </div>
            </div>

            {(searchType === 'parents' || searchType === 'children') && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700">
                    <Badge
                        variant="outline"
                        className="border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800"
                    >
                        {searchType === 'parents'
                            ? 'Showing parents of:'
                            : 'Showing all children of:'}
                        <span className="font-semibold ml-1">{relationClassName}</span>
                    </Badge>
                </div>
            )}

            <ScrollArea className="flex-1">
                <div className="space-y-0.5 p-1">
                    {filteredClasses.map((classNode) => (
                        <div key={classNode.name} className="relative group">
                            <button
                                onClick={() => setSelectedClass(classNode)}
                                className={`w-full text-left px-3 py-1.5 rounded-md transition-colors text-sm ${
                                    selectedClass?.name === classNode.name
                                        ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200'
                                }`}
                            >
                                {classNode.name}
                            </button>

                            <div className="absolute right-1 top-1.5 hidden group-hover:flex gap-1">
                                <button
                                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleParentsSearch(classNode.name)
                                    }}
                                    title="Show parents"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="18 15 12 9 6 15"></polyline>
                                    </svg>
                                </button>

                                <button
                                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleChildrenSearch(classNode.name)
                                    }}
                                    title="Show children"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}
