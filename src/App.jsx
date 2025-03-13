import { useState } from 'react'
import ClassList from './Components/explorer/ClassList'
import ClassDetails from './Components/Explorer/ClassDetails'

export default function App() {
    const [classes, _setClasses] = useState([
        {
            name: 'Man',
            parent_classes: ['Human'],
            properties: [
                {
                    name: 'name',
                    type: 'string',
                    description: 'The name',
                },
            ],
        },
        {
            name: 'Woman',
            parent_classes: ['Human'],
            properties: [
                {
                    name: 'name',
                    type: 'string',
                    description: 'The name',
                },
            ],
        },
        {
            name: 'Human',
            parent_classes: [],
            properties: [
                {
                    name: 'name',
                    type: 'string',
                    description: 'The name',
                },
            ],
        },
    ])
    const [selectedClass, setSelectedClass] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')

    return (
        <div className="dark font-sans">
            <div className="flex flex-col w-full h-full bg-gray-900">
                <ClassList
                    classes={classes}
                    selectedClass={selectedClass}
                    setSelectedClass={setSelectedClass}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                />
                <ClassDetails
                    selectedClass={selectedClass}
                    setSelectedClass={setSelectedClass}
                    allClasses={classes}
                />
            </div>
        </div>
    )
}
