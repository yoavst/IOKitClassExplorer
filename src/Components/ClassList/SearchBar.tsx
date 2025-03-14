import { FC } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

import { Search, X } from 'lucide-react'

interface SearchBarProps {
    searchQuery: string
    setSearchQuery: (searchQuery: string) => void
    suggestions: { text: string; color: string }[]
}

const SearchBar: FC<SearchBarProps> = ({ searchQuery, setSearchQuery, suggestions }) => {
    return (
        <div className="p-2 border-b border-gray-700">
            <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 pointer-events-none" />

                <Input
                    placeholder="Search classes"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value)
                    }}
                    className="pl-8 pr-10 text-sm h-9 bg-gray-700 text-white border-gray-600"
                />

                {searchQuery && (
                    <button
                        className="absolute right-2 top-2.5 p-0.5 rounded hover:bg-gray-600"
                        onClick={() => {
                            setSearchQuery('')
                        }}
                    >
                        <X className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-1 mt-2">
                {suggestions.map(({ text, color }) => (
                    <SuggestionChip
                        key={text}
                        color={color}
                        text={text}
                        setSearchQuery={setSearchQuery}
                    />
                ))}
            </div>
        </div>
    )
}

interface SuggestionChipProps {
    text: string
    color: string
    setSearchQuery: (searchQuery: string) => void
}

const SuggestionChip: FC<SuggestionChipProps> = ({ text, color, setSearchQuery }) => {
    return (
        <Badge
            onClick={() => {
                setSearchQuery(text)
            }}
            className={`text-xs py-0 px-1.5 cursor-pointer bg-${color}-800 text-white`}
        >
            {text}
        </Badge>
    )
}

export default SearchBar
