import { FC } from 'react'
import { Class } from '../../types.tsx'
import { ChevronUp, ChevronDown } from 'lucide-react'

type ClassListItem = {
    clazz: Class
    isSelected: boolean
    setSelectedClass: (selectedClass: Class) => void
    setSearchQuery: (searchQuery: string) => void
}

const ClassListItem: FC<ClassListItem> = ({
    clazz,
    setSelectedClass,
    isSelected,
    setSearchQuery,
}) => {
    return (
        <div className="relative group">
            <button
                onClick={() => setSelectedClass(clazz)}
                className={`w-full text-left px-3 py-1.5 rounded-md transition-colors text-sm ${
                    isSelected
                        ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200'
                }`}
            >
                {clazz.name}
            </button>

            <div className="absolute right-1 top-1.5 hidden group-hover:flex gap-1">
                <button
                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    onClick={() => setSearchQuery(`parents: ${clazz.name}`)}
                    title="Show parents"
                >
                    <ChevronUp
                        width={24}
                        height={24}
                        className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"
                    />
                </button>

                <button
                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    onClick={() => setSearchQuery(`children: ${clazz.name}`)}
                    title="Show children"
                >
                    <ChevronDown
                        width={24}
                        height={24}
                        className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400"
                    />
                </button>
            </div>
        </div>
    )
}

export default ClassListItem
