import { getChildren, getParents, Hierarchy } from '../../../utils/hierarchy'
import { ColDef, colorSchemeDark, ICellRendererParams, themeQuartz } from 'ag-grid-community'
import { Class, VirtualMethod } from '../../../utils/types'
import { FC, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react' // React Data Grid Component
import CircleText from '@/components/ui/circle-text'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FunctionNameView, TypeView } from './TypeView'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

interface VTableProps {
    currentClass: Class
    allClasses: Hierarchy<Class>
    setSelectedClass: (selectedClass: Class) => void
    setSearchQuery: (searchQuery: string) => void
}

function createArray<T>(length: number, value: () => T): T[] {
    return Array.from({ length }, value)
}

export interface VirtualMethodUI extends VirtualMethod {
    className: string
    parentImplementation: Class | null
    childrenImplementations: Class[]
    definedAt: Class

    allClasses: Hierarchy<Class>
    setSelectedClass: (selectedClass: Class) => void
    setSearchQuery: (searchQuery: string) => void
}

const enrichVirtualMethods = (
    currentClass: Class,
    allClasses: Hierarchy<Class>,
    setSelectedClass: (selectedClass: Class) => void,
    setSearchQuery: (searchQuery: string) => void
): VirtualMethodUI[] => {
    // We create an array for both parents and children implementations,
    // as in the future we might want to display them.
    if (!currentClass.vtable || currentClass.vtable.length === 0) return []
    const parentsImplementations = createArray<Class[]>(currentClass.vtable.length, () => [])
    const childrenImplementations = createArray<Class[]>(currentClass.vtable.length, () => [])
    const definedAt = createArray<Class | null>(currentClass.vtable.length, () => null)

    for (const parent of getParents(allClasses, currentClass.name)) {
        if (!parent.vtable) continue
        for (const [index, method] of parent.vtable.entries()) {
            if (definedAt[index] == null) {
                definedAt[index] = parent
            }
            if (!method.isPureVirtual) {
                parentsImplementations[index].push(parent)
            }
        }
    }
    for (const child of getChildren(allClasses, currentClass.name)) {
        if (!child.vtable) continue
        for (const [index, method] of child.vtable.entries()) {
            if (method.isImplementedByCurrentClass && !method.isPureVirtual) {
                childrenImplementations[index].push(child)
            }
        }
    }

    return currentClass.vtable.map((method, index) => ({
        ...method,
        className: currentClass.name,
        parentImplementation: parentsImplementations[index].at(-1) ?? null,
        childrenImplementations: childrenImplementations[index],
        definedAt: definedAt[index] ?? currentClass,
        allClasses,
        setSelectedClass,
        setSearchQuery,
    }))
}

type TableCellProps = ICellRendererParams<VirtualMethodUI>

const VtableIndex: FC<TableCellProps> = ({ data }) => {
    if (data === undefined) return ''

    let color: string, hint: string
    if (data.parentImplementation === null) {
        color = 'bg-green-500'
        hint = 'Defined in this class'
    } else if (data.isImplementedByCurrentClass) {
        color = 'bg-red-500'
        hint = 'Overridden in this class'
    } else {
        color = 'bg-blue-500'
        hint = 'Inherited from parent class'
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex w-full h-full items-center">
                        <CircleText text={data.vtableIndex.toString()} color={color} />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                    <p>{hint}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

const MethodName: FC<TableCellProps> = ({ data }) => {
    if (data === undefined) return ''

    return (
        <FunctionNameView
            name={data.name}
            parameters={data.parameters}
            allClasses={data.allClasses}
            setSelectedClass={data.setSelectedClass}
        />
    )
}

const ReturnType: FC<TableCellProps> = ({ data }) => {
    if (data === undefined) return ''

    return (
        <TypeView
            type={data.returnType}
            allClasses={data.allClasses}
            setSelectedClass={data.setSelectedClass}
        />
    )
}

const Actions: FC<TableCellProps> = ({ data }) => {
    if (data === undefined) return ''

    return (
        <div className="text-center">
            {data.parentImplementation !== null && (
                <button
                    className="rounded hover:bg-gray-600 cursor-pointer"
                    onClick={() => {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        data.setSelectedClass(data.parentImplementation!)
                        toast(
                            `Going to parent implementation for method ${data.className}::${data.name}`
                        )
                    }}
                    title="Going to parent implementation"
                >
                    <ChevronUp width={20} height={20} className="text-blue-400" />
                </button>
            )}
            {data.childrenImplementations.length !== 0 && (
                <button
                    className="rounded hover:bg-gray-600 cursor-pointer"
                    onClick={() => {
                        if (data.childrenImplementations.length === 1) {
                            data.setSelectedClass(data.childrenImplementations[0])
                            toast(
                                `Going to the single override for the method ${data.className}::${data.name}`
                            )
                        } else {
                            data.setSearchQuery(`overrides:${data.vtableIndex};${data.className}`)
                            toast(
                                `Showing results for overrides of ${data.className}::${data.name}`
                            )
                        }
                    }}
                    title="Show children implementations"
                >
                    <ChevronDown width={20} height={20} className="text-purple-400" />
                </button>
            )}
        </div>
    )
}
const VTable: FC<VTableProps> = ({
    currentClass,
    allClasses,
    setSelectedClass,
    setSearchQuery,
}) => {
    const enrichedVirtualMethods = useMemo(
        () => enrichVirtualMethods(currentClass, allClasses, setSelectedClass, setSearchQuery),
        [currentClass, allClasses, setSelectedClass, setSearchQuery]
    )

    // Column Definitions: Defines the columns to be displayed.
    const colDefs: ColDef<VirtualMethodUI>[] = [
        {
            headerName: '',
            field: 'vtableIndex',
            cellRenderer: VtableIndex,
            width: 30,
            resizable: false,
            pinned: 'left',
            sortingOrder: ['asc', 'desc'],
            sort: 'asc',
            cellStyle: { paddingLeft: 5, paddingRight: 0, paddingTop: 5 },
            headerStyle: { paddingLeft: 0, paddingRight: 0 },
        },
        {
            headerName: 'Name',
            field: 'name',
            cellRenderer: MethodName,
            filter: true,
            cellStyle: { paddingLeft: 0 },
        },
        { headerName: 'Return type', field: 'returnType', cellRenderer: ReturnType },
        {
            headerName: '',
            width: 40,
            cellStyle: { padding: '0' },
            cellRenderer: Actions,
            pinned: 'right',
            resizable: false,
        },
    ]

    return (
        <AgGridReact
            rowData={enrichedVirtualMethods}
            columnDefs={colDefs}
            rowClassRules={{
                'row-pure-virtual': (params) => params.data?.isPureVirtual ?? false,
            }}
            theme={themeQuartz.withPart(colorSchemeDark).withParams({
                headerHeight: 30,
                rowHeight: 30,
            })}
            animateRows={false}
            gridOptions={{
                defaultColDef: {
                    suppressMovable: true,
                },
                suppressCellFocus: false,
            }}
            enableCellTextSelection={true}
        />
    )
}

export default VTable
