import React, { useState, useEffect, useCallback } from 'react'
import { List, BookOpenText, Share2 } from 'lucide-react'

import ClassList from '../components/Explorer/ClassList.jsx'
import ClassDetails from '../components/Explorer/ClassDetails.jsx'
import ClassGraph from '../components/Explorer/ClassGraph.jsx'

export default function Explorer() {
    const [classes, setClasses] = useState([])
    const [selectedClass, setSelectedClass] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isMobileView, setIsMobileView] = useState(false)
    const [activePane, setActivePane] = useState('list')

    useEffect(() => {
        loadClasses()

        const handleResize = () => {
            setIsMobileView(window.innerWidth < 768)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const loadClasses = async () => {
        const data = [
            {
                name: 'Man',
                parent_classes: ['Human'],
                properties: [
                    {
                        name: 'name',
                        type: 'string',
                        description: 'The name',
                    },
                ],
            },
            {
                name: 'Woman',
                parent_classes: ['Human'],
                properties: [
                    {
                        name: 'name',
                        type: 'string',
                        description: 'The name',
                    },
                ],
            },
            {
                name: 'Human',
                parent_classes: [],
                properties: [
                    {
                        name: 'name',
                        type: 'string',
                        description: 'The name',
                    },
                ],
            },
        ]
        setClasses(data)
        if (data.length > 0) {
            setSelectedClass(data[0])
        }
    }

    const handleSelectClass = useCallback(
        (cls) => {
            setSelectedClass(cls)
            if (isMobileView) {
                setActivePane('details')
            }
        },
        [isMobileView]
    )

    // Handle search change separately from direct SearchInput changes
    const handleSearchChange = useCallback((query) => {
        setSearchQuery(query)
    }, [])

    // Mobile navigation
    const renderMobileNav = () => (
        <div className="flex border-b dark:border-gray-700">
            <button
                className={`flex-1 py-3 px-2 flex justify-center items-center gap-2 ${
                    activePane === 'list'
                        ? 'border-b-2 border-blue-500 text-blue-400'
                        : 'text-gray-400'
                }`}
                onClick={() => setActivePane('list')}
            >
                <List className="w-4 h-4" />
                Classes
            </button>
            <button
                className={`flex-1 py-3 px-2 flex justify-center items-center gap-2 ${
                    activePane === 'details'
                        ? 'border-b-2 border-blue-500 text-blue-400'
                        : 'text-gray-400'
                }`}
                onClick={() => setActivePane('details')}
            >
                <BookOpenText className="w-4 h-4" />
                Details
            </button>
            <button
                className={`flex-1 py-3 px-2 flex justify-center items-center gap-2 ${
                    activePane === 'graph'
                        ? 'border-b-2 border-blue-500 text-blue-400'
                        : 'text-gray-400'
                }`}
                onClick={() => setActivePane('graph')}
            >
                <Share2 className="w-4 h-4" />
                Graph
            </button>
        </div>
    )

    return (
        <div className="flex flex-col md:flex-row h-screen dark">
            {isMobileView && renderMobileNav()}

            {/* Left Pane - Class List */}
            <div
                className={`
        md:w-64 lg:w-72 border-r bg-gray-800 dark:border-gray-700 flex flex-col
        ${isMobileView && activePane !== 'list' ? 'hidden' : 'flex'}
        ${isMobileView ? 'h-[calc(100vh-48px)]' : ''}
      `}
            >
                <div className="p-3 border-b bg-gray-800 dark:border-gray-700 flex items-center gap-2">
                    <List className="w-4 h-4 text-blue-400" />
                    <h2 className="font-medium text-white">Classes</h2>
                </div>
                <div className="flex-1 overflow-hidden">
                    <ClassList
                        classes={classes}
                        selectedClass={selectedClass}
                        setSelectedClass={handleSelectClass}
                        searchQuery={searchQuery}
                        setSearchQuery={handleSearchChange}
                    />
                </div>
            </div>

            {/* Middle Pane - Details */}
            <div
                className={`
        md:w-1/3 lg:w-2/5 border-r bg-gray-800 dark:border-gray-700 flex flex-col
        ${isMobileView && activePane !== 'details' ? 'hidden' : 'flex'}
        ${isMobileView ? 'h-[calc(100vh-48px)]' : ''}
      `}
            >
                <div className="p-3 border-b bg-gray-800 dark:border-gray-700 flex items-center gap-2">
                    <BookOpenText className="w-4 h-4 text-green-400" />
                    <h2 className="font-medium text-white">Class Details</h2>
                </div>
                <div className="flex-1 overflow-auto">
                    <ClassDetails
                        selectedClass={selectedClass}
                        setSelectedClass={handleSelectClass}
                        allClasses={classes}
                    />
                </div>
            </div>

            {/* Right Pane - Graph View */}
            <div
                className={`
        flex-1 bg-gray-800 flex flex-col
        ${isMobileView && activePane !== 'graph' ? 'hidden' : 'flex'}
        ${isMobileView ? 'h-[calc(100vh-48px)]' : ''}
      `}
            >
                <div className="p-3 border-b bg-gray-800 dark:border-gray-700 flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-purple-400" />
                    <h2 className="font-medium text-white">Inheritance Graph</h2>
                </div>
                <div className="flex-1">
                    <ClassGraph
                        classes={classes}
                        onNodeClick={handleSelectClass}
                        selectedClass={selectedClass}
                    />
                </div>
            </div>
        </div>
    )
}
