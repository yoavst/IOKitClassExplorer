import { useState, useMemo, FC, useCallback, useEffect } from 'react'
import { List, BookOpenText, Share2 } from 'lucide-react'

import ClassList from './components/ClassList/ClassList.tsx'
import ClassDetails from './components/ClassDetails/ClassDetails.tsx'
import ClassGraph from './components/ClassGraph/ClassGraph.tsx'

import { createHierarchy } from './utils/hierarchy.ts'
import { Class } from './utils/types.tsx'
import classes from './classes.json'

const App: FC = () => {
    const [selectedClass, setSelectedClass] = useState<Class | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const classesHierarchy = useMemo(() => createHierarchy(classes), [])

    const setSelectedClassFromUrl = useCallback(() => {
        if (classes.length === 0) return

        const hash = window.location.hash
        if (hash.length !== 0) {
            const className = hash.slice(1)
            const selectedClass = classes.find((c) => c.name === className)
            setSelectedClass(selectedClass ?? classes[0])
        } else {
            setSelectedClass(classes[0])
        }
    }, [])

    if (selectedClass === null) {
        setSelectedClassFromUrl()
    }

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const onPopState = (_: PopStateEvent) => {
            setSelectedClassFromUrl()
        }

        window.addEventListener('popstate', onPopState)
        return () => {
            window.removeEventListener('popstate', onPopState)
        }
    }, [setSelectedClassFromUrl])

    const handleSelectedClass = useCallback((selectedClass: Class) => {
        setSelectedClass(selectedClass)
        history.pushState(
            selectedClass,
            `IOKitClassExplorer - ${selectedClass.name}`,
            `#${selectedClass.name}`
        )
    }, [])

    return (
        <div className="flex flex-col md:flex-row h-screen w-full dark bg-gray-800">
            {/* Left Pane - Class List */}
            <div className="w-90 border-r border-gray-700 flex flex-col">
                <div className="p-3 border-b border-gray-700 flex items-center gap-2">
                    <List className="w-4 h-4 text-blue-400" />
                    <h2 className="font-medium text-white">Classes</h2>
                </div>
                <div className="flex-1 overflow-hidden">
                    <ClassList
                        classesHierarchy={classesHierarchy}
                        selectedClass={selectedClass}
                        setSelectedClass={handleSelectedClass}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                    />
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                {/* Details */}
                <div className="w-full border-r border-b border-gray-700 flex flex-col max-h-6/10">
                    <div className="p-3 border-b border-gray-700 flex items-center gap-2">
                        <BookOpenText className="w-4 h-4 text-green-400" />
                        <h2 className="font-medium text-white">Class Details</h2>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <ClassDetails
                            selectedClass={selectedClass}
                            setSelectedClass={handleSelectedClass}
                            allClasses={classesHierarchy}
                            setSearchQuery={setSearchQuery}
                        />
                    </div>
                </div>

                {/* Graph View */}
                <div className="w-full flex-1 flex flex-col">
                    <div className="p-3 border-b border-gray-700 flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-purple-400" />
                        <h2 className="font-medium text-white">Inheritance Graph</h2>
                    </div>
                    <div className="flex-1">
                        {
                            <ClassGraph
                                classes={classesHierarchy}
                                setSelectedClass={handleSelectedClass}
                                selectedClass={selectedClass}
                            />
                        }
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App
