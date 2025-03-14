import { useMemo, FC } from 'react'
import { getDirectChildren, getChildren, getParents, Hierarchy } from '../../utils/hierarchy.ts'
import JSONView from './JSONView.tsx'
import InhertianceChain from './InhertianceChain.tsx'
import ChildrenBadges from './ChildrenBadges.tsx'
import { Class } from '../../utils/types.tsx'

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
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4 text-white">{selectedClass.name}</h2>
            <div className="space-y-5">
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

                <div>
                    <h3 className="text-sm font-semibold mb-2 text-gray-300">Properties</h3>
                    <div className="bg-gray-900 rounded-md p-3 overflow-auto text-xs max-h-96 text-gray-200 border border-gray-700">
                        <JSONView data={selectedClass.properties ?? {}} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ClassDetails
