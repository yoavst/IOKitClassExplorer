import { Class } from '../../utils/types.tsx'
import { FC } from 'react'
import { GitBranchPlus } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'

interface InhertianceChainProps {
    setSelectedClass: (selectedClass: Class) => void
    currentClass: Class
    inhertianceChain: Class[]
}
const InhertianceChain: FC<InhertianceChainProps> = ({
    setSelectedClass,
    currentClass,
    inhertianceChain,
}) => {
    return (
        <div>
            <h3 className="text-sm font-semibold flex items-center gap-1 text-gray-300">
                <GitBranchPlus className="w-4 h-4" />
                Inheritance Chain
            </h3>
            <div className="space-y-1 ml-1">
                <InhertianceChainButton
                    setSelectedClass={setSelectedClass}
                    clazz={currentClass}
                    showArrow={false}
                />
                {inhertianceChain.map((cls) => (
                    <InhertianceChainButton
                        key={cls.name}
                        setSelectedClass={setSelectedClass}
                        clazz={cls}
                        showArrow={true}
                    />
                ))}
            </div>
        </div>
    )
}

interface InhertianceChainButtonProps {
    setSelectedClass: (selectedClass: Class) => void
    clazz: Class
    showArrow: boolean
}

const InhertianceChainButton: FC<InhertianceChainButtonProps> = ({
    setSelectedClass,
    clazz,
    showArrow,
}) => {
    return (
        <div key={clazz.name} className="flex items-center">
            {showArrow && (
                <div className="w-5 h-5 flex items-center justify-center text-gray-400">↑</div>
            )}
            <Button
                variant="ghost"
                size="sm"
                className="text-blue-400 hover:text-blue-300 px-2 h-6"
                onClick={() => {
                    setSelectedClass(clazz)
                }}
            >
                {clazz.name}
            </Button>
        </div>
    )
}

export default InhertianceChain
