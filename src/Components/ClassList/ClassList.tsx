import { useMemo, FC } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import ClassListItem from './ClassListItem.tsx'
import SearchBar from './SearchBar.tsx'
import { Class } from '../../types.tsx'
import { getNodes, getChildren, getParents, Hierarchy, getNode } from '../../utils/hierarchy.ts'

type ClassListProps = {
    classesHierarchy: Hierarchy<Class>
    selectedClass: Class | null
    setSelectedClass: (selectedClass: Class) => void
    searchQuery: string
    setSearchQuery: (searchQuery: string) => void
}

enum SearchType {
    normal,
    parents,
    children,
}

const ClassList: FC<ClassListProps> = ({
    classesHierarchy,
    selectedClass,
    setSelectedClass,
    searchQuery,
    setSearchQuery,
}) => {
    const classesSorted = useMemo(
        () => getNodes(classesHierarchy).toSorted((a, b) => a.name.localeCompare(b.name)),
        [classesHierarchy]
    )
    const [searchType, searchTerm] = useMemo(() => {
        if (searchQuery.startsWith('parents:')) {
            return [SearchType.parents, searchQuery.slice(8).trim()]
        } else if (searchQuery.startsWith('children:')) {
            return [SearchType.children, searchQuery.slice(9).trim()]
        } else {
            return [SearchType.normal, searchQuery.trim()]
        }
    }, [searchQuery])

    const filteredClasses = useMemo(() => {
        let filteredClasses: Class[]
        switch (searchType) {
            case SearchType.parents: {
                const clazz = getNode(classesHierarchy, searchTerm)
                if (clazz == null) filteredClasses = []
                else filteredClasses = getParents(classesHierarchy, clazz.name)
                break
            }
            case SearchType.children: {
                const clazz = getNode(classesHierarchy, searchTerm)
                if (clazz == null) filteredClasses = []
                else filteredClasses = getChildren(classesHierarchy, clazz.name)
                break
            }
            case SearchType.normal: {
                if (searchTerm.length === 0) return classesSorted
                try {
                    const regex = new RegExp(searchQuery, 'i')
                    filteredClasses = classesSorted.filter(({ name }) => regex.test(name))
                } catch {
                    const lowerCaseSearchQuery = searchQuery.toLowerCase()
                    filteredClasses = classesSorted.filter(({ name }) =>
                        name.toLowerCase().includes(lowerCaseSearchQuery)
                    )
                }
                break
            }
        }
        filteredClasses.sort((a, b) => a.name.localeCompare(b.name))
        return filteredClasses
    }, [searchType, searchTerm, classesHierarchy])

    return (
        <div className="w-full h-full flex flex-col">
            <SearchBar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                suggestions={
                    classesSorted.length == 0
                        ? []
                        : [
                              {
                                  text: `parents: ${classesSorted[classesSorted.length - 1].name}`,
                                  color: 'blue',
                              },
                              {
                                  text: `children: ${classesSorted[0].name}`,
                                  color: 'purple',
                              },
                          ]
                }
            />
            {searchType != SearchType.normal && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700">
                    <Badge
                        variant="outline"
                        className="border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800"
                    >
                        <span className="font-semibold ml-1">
                            {searchType === SearchType.parents
                                ? 'Showing parents of: '
                                : 'Showing all children of: '}
                            {searchTerm}
                        </span>
                    </Badge>
                </div>
            )}

            <ScrollArea className="flex-1">
                <div className="space-y-0.5 p-1">
                    {filteredClasses.map((clazz) => (
                        <ClassListItem
                            key={clazz.name}
                            clazz={clazz}
                            isSelected={clazz.name === selectedClass?.name}
                            setSelectedClass={setSelectedClass}
                            setSearchQuery={setSearchQuery}
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}

export default ClassList
