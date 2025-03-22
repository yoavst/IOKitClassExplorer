import { FC } from 'react'

const CircleText: FC<{ text: string; color?: string }> = ({ text, color = 'bg-blue-500' }) => {
    const fontSize = text.length == 1 ? '0.8em' : text.length == 2 ? '0.7rem' : '0.6rem'
    return (
        <div
            className={`w-5 h-5 flex items-center justify-center rounded-full ${color} text-white font-bold`}
            style={{
                fontSize,
            }}
        >
            {text}
        </div>
    )
}

export default CircleText
