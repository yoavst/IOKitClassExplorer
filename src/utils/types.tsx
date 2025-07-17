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
