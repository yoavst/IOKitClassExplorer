import { useMemo, FC } from 'react'
import { FixedSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import ClassListItem from './ClassListItem.tsx'
import SearchBar from './SearchBar.tsx'
import { Class } from '../../utils/types.tsx'
import { getNodes, getChildren, getParents, Hierarchy, getNode } from '../../utils/hierarchy.ts'

const ITEM_SIZE = 32

interface ClassListProps {
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
    }, [searchType, classesHierarchy, searchTerm, classesSorted, searchQuery])

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
                <div
                    className={`p-1 pl-3 text-xs text-white font-semibold ${searchType === SearchType.parents ? 'bg-blue-800' : 'bg-purple-800'}`}
                >
                    {searchType === SearchType.parents
                        ? 'Showing parents of: '
                        : 'Showing all children of: '}
                    {searchTerm}
                </div>
            )}
            <div className="w-full h-full">
                <AutoSizer>
                    {({ height, width }) => (
                        <List
                            height={height}
                            itemCount={filteredClasses.length}
                            itemSize={ITEM_SIZE}
                            width={width}
                        >
                            {({ index, style }) => (
                                <div style={style}>
                                    <ClassListItem
                                        clazz={filteredClasses[index]}
                                        isSelected={
                                            filteredClasses[index].name === selectedClass?.name
                                        }
                                        setSelectedClass={setSelectedClass}
                                        setSearchQuery={setSearchQuery}
                                    />
                                </div>
                            )}
                        </List>
                    )}
                </AutoSizer>
            </div>
        </div>
    )
}

export default ClassList
