import { getChildren, getParents, Hierarchy } from '../../../utils/hierarchy'
import { ColDef, colorSchemeDark, ICellRendererParams, themeQuartz } from 'ag-grid-community'
import { Class, VirtualMethod } from '../../../utils/types'
import { FC, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react' // React Data Grid Component
import CircleText from '@/components/ui/circle-text'
import { FunctionNameView, TypeView } from './TypeView'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface VTableProps {
    currentClass: Class
    allClasses: Hierarchy<Class>
    setSelectedClass: (selectedClass: Class) => void
}

function createArray<T>(length: number, value: () => T): T[] {
    return Array.from({ length }, value)
}

export interface VirtualMethodUI extends VirtualMethod {
    parentsImplementation: Class[]
    childrenImplementation: Class[]
    definedAt: Class

    allClasses: Hierarchy<Class>
    setSelectedClass: (selectedClass: Class) => void
}

const enrichVirtualMethods = (
    currentClass: Class,
    allClasses: Hierarchy<Class>,
    setSelectedClass: (selectedClass: Class) => void
): VirtualMethodUI[] => {
    // Implement the function logic here
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
            if (!method.isPureVirtual) {
                childrenImplementations[index].push(child)
            }
        }
    }

    return currentClass.vtable.map((method, index) => ({
        ...method,
        parentsImplementation: parentsImplementations[index],
        childrenImplementation: childrenImplementations[index],
        definedAt: definedAt[index] ?? currentClass,
        allClasses,
        setSelectedClass,
    }))
}

type TableCellProps = ICellRendererParams<VirtualMethodUI>

const VtableIndex: FC<TableCellProps> = ({ data }) => {
    if (data === undefined) return ''

    return (
        <div className="flex w-full h-full items-center">
            <CircleText
                text={data.vtableIndex.toString()}
                color={data.parentsImplementation.length != 0 ? 'bg-blue-500' : 'bg-green-500'}
            />
        </div>
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
            {data.parentsImplementation.length !== 0 && (
                <button
                    className="rounded hover:bg-gray-600 cursor-pointer"
                    onClick={() => {
                        data.setSelectedClass(
                            data.parentsImplementation[data.parentsImplementation.length - 1]
                        )
                    }}
                    title="Go to parent implementation"
                >
                    <ChevronUp width={20} height={20} className="text-blue-400" />
                </button>
            )}
            {data.childrenImplementation.length !== 0 && (
                <button
                    className="rounded hover:bg-gray-600 cursor-pointer"
                    onClick={() => {
                        //FIXME: Implement the logic here
                        void 0
                    }}
                    title="Show children implementations"
                >
                    <ChevronDown width={20} height={20} className="text-purple-400" />
                </button>
            )}
        </div>
    )
}
const VTable: FC<VTableProps> = ({ currentClass, allClasses, setSelectedClass }) => {
    const enrichedVirtualMethods = useMemo(
        () => enrichVirtualMethods(currentClass, allClasses, setSelectedClass),
        [currentClass, allClasses, setSelectedClass]
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
                'row-override': (params) => {
                    if (!params.data) return false
                    return (
                        params.data.isImplementedByCurrentClass &&
                        params.data.parentsImplementation.length > 0
                    )
                },
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
