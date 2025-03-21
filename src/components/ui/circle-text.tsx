import { FC } from 'react'

const CircleText: FC<{ text: string; color?: string }> = ({ text, color = 'bg-blue-500' }) => {
    const fontSize = text.length == 1 ? '0.75em' : text.length == 2 ? '0.5rem' : '0.4rem'
    return (
        <div
            className={`w-4 h-4 flex items-center justify-center rounded-full ${color} text-white font-bold`}
            style={{
                fontSize,
            }}
        >
            {text}
        </div>
    )
}

export default CircleText
