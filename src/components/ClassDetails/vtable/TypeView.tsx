import { getNode, Hierarchy } from '@/utils/hierarchy'
import { Class, MethodParameter } from '@/utils/types'
import { FC, Fragment, useMemo } from 'react'

interface TypeViewParams {
    type: string
    allClasses: Hierarchy<Class>
    setSelectedClass: (selectedClass: Class) => void
}

export const TypeView: FC<TypeViewParams> = ({ type, allClasses, setSelectedClass }) => {
    const strippedType = useMemo(() => type.replace(/const|volatile|&|\*|\s/g, '').trim(), [type])
    const matchedType = useMemo(() => getNode(allClasses, strippedType), [allClasses, strippedType])

    if (matchedType == null) {
        // Type is either a function type (which could be supported in the future), or not a builtin type.
        // Either way, just print it as is.
        return <span>{type}</span>
    } else {
        const startIndex = type.indexOf(strippedType)
        const endIndex = startIndex + strippedType.length
        const prefix = type.slice(0, startIndex)
        const suffix = type.slice(endIndex)

        return (
            <>
                {prefix && <span>{prefix}</span>}
                <span
                    className="text-blue-300 cursor-pointer"
                    onClick={() => {
                        setSelectedClass(matchedType)
                    }}
                >
                    {strippedType}
                </span>
                {suffix && <span>{suffix}</span>}
            </>
        )
    }
}

interface NamedTypeViewParams extends TypeViewParams {
    name: string | null
}

export const NamedTypeView: FC<NamedTypeViewParams> = ({
    name,
    type,
    allClasses,
    setSelectedClass,
}) => {
    if (name == null || type.toLowerCase().includes(name.toLowerCase()))
        return <TypeView type={type} allClasses={allClasses} setSelectedClass={setSelectedClass} />
    return (
        <>
            <TypeView type={type} allClasses={allClasses} setSelectedClass={setSelectedClass} />
            <span className="text-gray-400"> {name}</span>
        </>
    )
}

interface NamedTypeViewParams extends TypeViewParams {
    name: string | null
}

interface ParametersViewParams {
    parameters: MethodParameter[]
    allClasses: Hierarchy<Class>
    setSelectedClass: (selectedClass: Class) => void
}
export const ParametersView: FC<ParametersViewParams> = ({
    parameters,
    allClasses,
    setSelectedClass,
}) => {
    return (
        <span className="text-gray-400">
            (
            {parameters.map((p, i) => (
                <Fragment key={i}>
                    <NamedTypeView
                        name={p.name}
                        type={p.type}
                        allClasses={allClasses}
                        setSelectedClass={setSelectedClass}
                    />
                    {i < parameters.length - 1 && <span>, </span>}
                </Fragment>
            ))}
            )
        </span>
    )
}

interface FunctionNameViewParams {
    name: string
    parameters: MethodParameter[]
    allClasses: Hierarchy<Class>
    setSelectedClass: (selectedClass: Class) => void
}

export const FunctionNameView: FC<FunctionNameViewParams> = ({
    name,
    parameters,
    allClasses,
    setSelectedClass,
}) => {
    return (
        <div className="pl-2">
            <span>{name}</span>
            <ParametersView
                parameters={parameters}
                allClasses={allClasses}
                setSelectedClass={setSelectedClass}
            />
        </div>
    )
}
