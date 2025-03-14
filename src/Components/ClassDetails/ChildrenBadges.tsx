import { Class } from '../../types.tsx'
import { FC } from 'react'
import { Badge } from '@/components/ui/badge'
import { ArrowUpRight, ArrowRight } from 'lucide-react'

const MAX_BADGES = 10

type ChildrenBadgesProps = {
    directChildren: Class[]
    indirectChildren: Class[]
    selectedClass: Class
    setSelectedClass: (selectedClass: Class) => void
    setSearchQuery: (query: string) => void
}

const ChildrenBadges: FC<ChildrenBadgesProps> = ({
    directChildren,
    indirectChildren,
    selectedClass,
    setSelectedClass,
    setSearchQuery,
}) => {
    const hasMoreDirectChildren = directChildren.length > MAX_BADGES
    const hasMoreIndirectChildren = indirectChildren.length > MAX_BADGES

    const displayedDirectChildren = hasMoreDirectChildren
        ? directChildren.slice(0, MAX_BADGES)
        : directChildren

    const displayedIndirectChildren = hasMoreIndirectChildren
        ? indirectChildren.slice(0, MAX_BADGES)
        : indirectChildren

    const hasChildren = directChildren.length + indirectChildren.length > 0

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-300">
                    {'Children '}
                    {hasChildren && `(${directChildren.length + indirectChildren.length})`}
                </h3>
            </div>

            {!hasChildren ? (
                <div className="text-sm text-gray-400">No children</div>
            ) : (
                <>
                    <div className="mb-3">
                        <ChildrenTitle text="Direct Children" count={directChildren.length} />
                        <div className="flex flex-wrap gap-1.5">
                            {displayedDirectChildren.map((child) => (
                                <ChildBadge
                                    child={child}
                                    setSelectedClass={setSelectedClass}
                                    key={child.name}
                                />
                            ))}
                            {hasMoreDirectChildren && (
                                <ShowMoreChildrenBadge
                                    count={directChildren.length - 10}
                                    parent={selectedClass}
                                    setSearchQuery={setSearchQuery}
                                />
                            )}
                            {displayedDirectChildren.length === 0 && (
                                <span className="text-xs text-gray-400">No direct children</span>
                            )}
                        </div>
                    </div>

                    {indirectChildren.length > 0 && (
                        <div>
                            <ChildrenTitle
                                text="Indirect Children"
                                count={indirectChildren.length}
                            />
                            <div className="flex flex-wrap gap-1.5">
                                {displayedIndirectChildren.map((child) => (
                                    <ChildBadge
                                        child={child}
                                        setSelectedClass={setSelectedClass}
                                        key={child.name}
                                    />
                                ))}
                                {hasMoreIndirectChildren && (
                                    <ShowMoreChildrenBadge
                                        count={indirectChildren.length - 10}
                                        parent={selectedClass}
                                        setSearchQuery={setSearchQuery}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

type ChildBadgeProps = {
    child: Class
    setSelectedClass: (selectedClass: Class) => void
}

const ChildBadge: FC<ChildBadgeProps> = ({ child, setSelectedClass }) => {
    return (
        <Badge
            key={child.name}
            variant="secondary"
            className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-xs"
            onClick={() => setSelectedClass(child)}
        >
            {child.name}
            <ArrowUpRight className="w-3 h-3 ml-1" />
        </Badge>
    )
}

type ShowMoreChildrenBadgeProps = {
    count: number
    parent: Class
    setSearchQuery: (query: string) => void
}

const ShowMoreChildrenBadge: FC<ShowMoreChildrenBadgeProps> = ({
    count,
    parent,
    setSearchQuery,
}) => {
    return (
        <Badge
            variant="outline"
            className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-xs"
            onClick={() => setSearchQuery(`children: ${parent.name}`)}
        >
            ...and {count} more
        </Badge>
    )
}

type ChildrenTitleProps = {
    text: string
    count: number
}

const ChildrenTitle: FC<ChildrenTitleProps> = ({ text, count }) => {
    return (
        <h4 className="text-xs text-gray-400 mb-1 flex items-center">
            <ArrowRight className="h-3 w-3 mr-1" />
            {text} {count > 0 && `(${count})`}
        </h4>
    )
}

export default ChildrenBadges
