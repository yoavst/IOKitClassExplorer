export interface Class {
    name: string
    parent: string | null
    properties?: Record<string, unknown>
}
