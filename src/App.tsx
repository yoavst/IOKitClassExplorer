import { useState, useEffect, useMemo, FC } from 'react'
import { List, BookOpenText, Share2 } from 'lucide-react'

import ClassList from './components/ClassList/ClassList.tsx'
import ClassDetails from './components/ClassDetails/ClassDetails.tsx'
import ClassGraph from './components/ClassGraph/ClassGraph.tsx'

import { createHierarchy } from './utils/hierarchy.ts'
import { Class } from './utils/types.tsx'

const App: FC = () => {
    const [classes, setClasses] = useState<Class[]>([])
    const [selectedClass, setSelectedClass] = useState<Class | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    const classesHierarchy = useMemo(() => createHierarchy(classes), [classes])

    useEffect(() => {
        loadClasses()
    }, [])

    const loadClasses = () => {
        const data = [
            {
                name: 'Man',
                parent: 'Human',
                properties: [
                    {
                        name: 'name',
                        type: 'string',
                        description: 'The name',
                        array: [1, 2, 3],
                        twst: null,
                    },
                ],
            },
            {
                name: 'Yoav',
                parent: 'Man',
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
                parent: 'Human',
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
                parent: null,
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

    return (
        <div className="flex flex-col md:flex-row h-screen dark">
            {/* Left Pane - Class List */}
            <div className="md:w-64 lg:w-72 border-r bg-gray-800 border-gray-700 flex flex-col">
                <div className="p-3 border-b border-gray-700 flex items-center gap-2">
                    <List className="w-4 h-4 text-blue-400" />
                    <h2 className="font-medium text-white">Classes</h2>
                </div>
                <div className="flex-1 overflow-hidden">
                    <ClassList
                        classesHierarchy={classesHierarchy}
                        selectedClass={selectedClass}
                        setSelectedClass={setSelectedClass}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                    />
                </div>
            </div>

            {/* Middle Pane - Details */}
            <div className="md:w-1/3 lg:w-2/5 border-r bg-gray-800 border-gray-700 flex flex-col">
                <div className="p-3 border-b bg-gray-800 border-gray-700 flex items-center gap-2">
                    <BookOpenText className="w-4 h-4 text-green-400" />
                    <h2 className="font-medium text-white">Class Details</h2>
                </div>
                <div className="flex-1 overflow-auto">
                    <ClassDetails
                        selectedClass={selectedClass}
                        setSelectedClass={setSelectedClass}
                        allClasses={classesHierarchy}
                        setSearchQuery={setSearchQuery}
                    />
                </div>
            </div>

            {/* Right Pane - Graph View */}
            <div className="flex-1 bg-gray-800 flex flex-col">
                <div className="p-3 border-b bg-gray-800 border-gray-700 flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-purple-400" />
                    <h2 className="font-medium text-white">Inheritance Graph</h2>
                </div>
                <div className="flex-1">
                    <ClassGraph
                        classes={classesHierarchy}
                        setSelectedClass={setSelectedClass}
                        selectedClass={selectedClass}
                    />
                </div>
            </div>
        </div>
    )
}

export default App
