import { FC } from 'react'

type JSONViewProps = {
    data: any
    level?: number
}

const JSONView: FC<JSONViewProps> = ({ data, level = 0 }) => {
    if (data === null || data === undefined)
        return <span className="text-gray-500 dark:text-gray-400">null</span>

    // primitives
    if (typeof data !== 'object') {
        if (typeof data === 'string')
            return <span className="text-green-600 dark:text-green-400">"{data}"</span>
        if (typeof data === 'number')
            return <span className="text-blue-600 dark:text-blue-400">{data}</span>
        if (typeof data === 'boolean')
            return <span className="text-purple-600 dark:text-purple-400">{data.toString()}</span>
        return <span>{String(data)}</span>
    }

    const isArray = Array.isArray(data)
    const isEmpty = Object.keys(data).length === 0

    if (isEmpty) {
        return <span>{isArray ? '[]' : '{}'}</span>
    }

    return (
        <div className="font-mono text-sm">
            <span>{isArray ? '[' : '{'}</span>
            {Object.entries(data).map(([key, value], index) => (
                <div key={key} className="ml-4">
                    {!isArray && <span className="text-red-600 dark:text-red-400">{key}</span>}
                    {!isArray && <span>: </span>}
                    <JSONView data={value} level={level + 1} />
                    {index < Object.keys(data).length - 1 && <span>,</span>}
                </div>
            ))}
            <span>{isArray ? ']' : '}'}</span>
        </div>
    )
}

export default JSONView
