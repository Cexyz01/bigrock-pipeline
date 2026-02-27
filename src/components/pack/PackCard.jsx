import { useState } from 'react'
import { ScaledCard, RARITY_COLORS } from './CardRenderer'

export default function PackCard({ card, owned, onClick, copyInfo, totalCopies }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const r = RARITY_COLORS[card.rarity] || RARITY_COLORS.common

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={() => onClick(card, owned)}
      style={{
        cursor: 'pointer',
        transform: pressed
          ? 'translateY(0px) scale(0.96)'
          : hovered ? 'translateY(-4px) scale(1.03)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <ScaledCard card={card} owned={owned} copyInfo={copyInfo} totalCopies={totalCopies} />
    </div>
  )
}

export { RARITY_COLORS }
