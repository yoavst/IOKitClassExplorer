export interface Class {
    name: string
    parent: string | null
    isAbstract: boolean
    properties?: Record<string, unknown>
    vtable?: VirtualMethod[]
}

export interface VirtualMethod {
    prototypeIndex: number
    isOverridden: boolean
    isPureVirtual: boolean
    mangledName: string | null
}

export interface Prototype {
    name: string
    returnType: string
    parameters: MethodParameter[]
    vtableIndex: number
    declaringClass: string
    protoIndex: number
}

export interface MethodParameter {
    name: string | null
    type: string
}

export interface JSONClass {
    name: string
    parent: string | null
    isAbstract: boolean
    properties?: Record<string, unknown>
    vtable?: JSONVirtualMethod[]
}

type JSONVirtualMethod = [
    prototypeIndex: number,
    isOverriden: boolean,
    isPureVirtual: boolean,
    mangledName: string | null,
]

export function classesFromJSON(classesJson: JSONClass[]): Class[] {
    const classes: Class[] = []
    for (const clazz of classesJson) {
        if (!clazz.vtable) {
            classes.push(clazz as Class)
        } else {
            const vtable: VirtualMethod[] = clazz.vtable.map((v) => ({
                prototypeIndex: v[0],
                isOverridden: v[1],
                isPureVirtual: v[2],
                mangledName: v[3],
            }))
            classes.push({ ...clazz, vtable })
        }
    }
    return classes
}
