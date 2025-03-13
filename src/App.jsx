import { useState } from 'react'
import ClassList from './Components/explorer/ClassList.jsx'
import ClassDetails from './Components/Explorer/ClassDetails.jsx'

export default function App() {
    const [classes, _setClasses] = useState([
        {
            name: 'Man',
            parent: 'Human',
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
            parent: 'Human',
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
            parent: null,
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
