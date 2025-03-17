export interface Class {
    name: string
    parent: string | null
    isAbstract: boolean
    properties?: Record<string, unknown>
}
