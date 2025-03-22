import { useMemo, FC } from 'react'
import { getDirectChildren, getChildren, getParents, Hierarchy } from '../../utils/hierarchy.ts'
import JSONView from './JSONView.tsx'
import InhertianceChain from './InhertianceChain.tsx'
import ChildrenBadges from './ChildrenBadges.tsx'
import { Class } from '../../utils/types.tsx'
import { Code, FileCode } from 'lucide-react'
import { Badge } from '@/components/ui/badge.tsx'
import VTable from './vtable/Vtable.tsx'

interface ClassDetailsProps {
    selectedClass: Class | null
    setSelectedClass: (selectedClass: Class) => void
    allClasses: Hierarchy<Class>
    setSearchQuery: (query: string) => void
}

const ClassDetails: FC<ClassDetailsProps> = ({
    selectedClass,
    setSelectedClass,
    allClasses,
    setSearchQuery,
}) => {
    if (!selectedClass) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Select a class to view details
            </div>
        )
    }
    return (
        <ClassDetailsInternal
            selectedClass={selectedClass}
            setSelectedClass={setSelectedClass}
            allClasses={allClasses}
            setSearchQuery={setSearchQuery}
        />
    )
}

const ClassDetailsInternal: FC<ClassDetailsProps & { selectedClass: Class }> = ({
    selectedClass,
    setSelectedClass,
    allClasses,
    setSearchQuery,
}) => {
    const directChildren = useMemo(
        () => getDirectChildren(allClasses, selectedClass.name),
        [allClasses, selectedClass]
    )

    const indirectChildren = useMemo(
        () =>
            getChildren(allClasses, selectedClass.name).filter(
                (child) => !directChildren.includes(child)
            ),
        [allClasses, directChildren, selectedClass]
    )
    const parentsChain = useMemo(
        () => getParents(allClasses, selectedClass.name),
        [allClasses, selectedClass]
    )

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="flex items-center mb-4">
                <h2 className="text-xl font-bold text-white mr-3">{selectedClass.name}</h2>
                {selectedClass.isAbstract && (
                    <Badge
                        variant="outline"
                        className="bg-purple-900/30 text-purple-300 border-purple-700 mt-1.5"
                    >
                        <FileCode className="w-3 h-3 mr-1" />
                        Abstract
                    </Badge>
                )}
            </div>
            <div className="space-y-5 flex flex-row gap-3 flex-1">
                <div className="flex-1">
                    <InhertianceChain
                        setSelectedClass={setSelectedClass}
                        inhertianceChain={parentsChain}
                        currentClass={selectedClass}
                    />

                    <ChildrenBadges
                        directChildren={directChildren}
                        indirectChildren={indirectChildren}
                        selectedClass={selectedClass}
                        setSelectedClass={setSelectedClass}
                        setSearchQuery={setSearchQuery}
                    />
                </div>

                <div className="flex-1 flex flex-col">
                    {Object.keys(selectedClass.vtable ?? {}).length !== 0 && (
                        <div className="flex-1 flex flex-col">
                            <h3 className="text-sm font-semibold flex items-center gap-1 text-gray-300 pb-2">
                                <Code className="w-4 h-4" />
                                Virtual Methods Table
                            </h3>
                            <div className="flex-1">
                                <VTable
                                    currentClass={selectedClass}
                                    allClasses={allClasses}
                                    setSelectedClass={setSelectedClass}
                                    setSearchQuery={setSearchQuery}
                                />
                            </div>
                        </div>
                    )}
                    {Object.keys(selectedClass.properties ?? {}).length !== 0 && (
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold mb-2 text-gray-300">Properties</h3>
                            <div className="bg-gray-900 rounded-md p-3 overflow-auto text-xs max-h-96 text-gray-200 border border-gray-700">
                                <JSONView data={selectedClass.properties ?? {}} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ClassDetails
