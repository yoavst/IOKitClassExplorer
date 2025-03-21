export interface Class {
    name: string
    parent: string | null
    isAbstract: boolean
    properties?: Record<string, unknown>
    vtable?: VirtualMethod[]
}

export interface VirtualMethod {
    vtableIndex: number
    name: string
    parameters: MethodParameter[]
    returnType: string
    isPureVirtual: boolean
    isImplementedByCurrentClass: boolean
}

export interface MethodParameter {
    name: string | null
    type: string
}
