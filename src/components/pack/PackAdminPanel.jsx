import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { getPackConfig, savePackConfig, getPackStats, getPackStatsByType, insertGeneratedPacks, deleteAllGeneratedPacks, getPackCards, getPacksRemaining, updatePackCard, uploadCardImage, setTcgGameActive, resetAllUserCards, resetAllUserTimers, resetAllOpenedPacks, resetAllTradeTokens, getRecentRareFinds, getUserCardStats, getTopCollectors, getCollectionCount } from '../../lib/supabase'
import { PACK_RARITIES, NON_COMMON_RARITIES, PACK_TYPES, PACKS_PER_POOL, CARDS_PER_PACK } from '../../lib/constants'

const ACCENT = '#F28C28'
const RARITY_COLORS = {
  rainbow: '#EC4899', diamond: '#06B6D4', gold: '#F59E0B', rare: '#3B82F6', common: '#64748B',
}
const RARITY_LABELS = {
  rainbow: 'Rainbow', diamond: 'Diamond', gold: 'Gold', rare: 'Rare', common: 'Common',
}

function getTimeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

const DARK = {
  bg: '#1a1a1a',
  card: '#222222',
  cardBorder: '#2d2d2d',
  cardHover: '#2a2a2a',
  text: '#E2E8F0',
  muted: '#94A3B8',
  dim: '#64748B',
  input: '#1a1a1a',
  inputBorder: '#3a3a3a',
  danger: '#EF4444',
  success: '#22C55E',
}

const BASE_TABS = [
  { id: 'system', label: 'System' },
  { id: 'generation', label: 'Generation' },
  { id: 'stats', label: 'Statistics' },
  { id: 'cards', label: 'Card Manager' },
]

export default function PackAdminPanel({ addToast, requestConfirm, tcgGameActive, onGameStateChange }) {
  const [tab, setTab] = useState('system')

  // Debug tab only visible when game is NOT active
  const adminTabs = useMemo(() => {
    if (tcgGameActive) return BASE_TABS
    return [...BASE_TABS, { id: 'debug', label: '🛠 Debug' }]
  }, [tcgGameActive])

  // Auto-switch away from debug tab if game becomes active
  useEffect(() => {
    if (tcgGameActive && tab === 'debug') setTab('system')
  }, [tcgGameActive, tab])
  const [config, setConfig] = useState(null)
  const [stats, setStats] = useState({ total: 0, assigned: 0, opened: 0 })
  const [perPoolStats, setPerPoolStats] = useState({})
  const [remaining, setRemaining] = useState({ red: 0, green: 0, blue: 0 })
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(0)

  // Rich stats
  const [recentRare, setRecentRare] = useState([])
  const [topCollectorsList, setTopCollectorsList] = useState([])
  const [userCardStats, setUserCardStats] = useState([])
  const [collectionCount, setCollectionCount] = useState(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [cfg, st, c, rem] = await Promise.all([
      getPackConfig(),
      getPackStats(),
      getPackCards(),
      getPacksRemaining(),
    ])
    if (cfg && !cfg.no_common_slots) cfg.no_common_slots = [false, false, false, false]
    setConfig(cfg)
    setStats(st)
    setCards(c)
    setRemaining(rem)

    // Per-pool stats
    const poolStats = {}
    for (const pt of PACK_TYPES) {
      poolStats[pt.id] = await getPackStatsByType(pt.id)
    }
    setPerPoolStats(poolStats)

    // Rich stats — rare finds, collectors, user card data
    const rareNums = c.filter(card => card.rarity === 'diamond' || card.rarity === 'rainbow').map(card => card.number)
    const [rare, collectors, ucStats, colCount] = await Promise.all([
      getRecentRareFinds(rareNums, 20),
      getTopCollectors(10),
      getUserCardStats(),
      getCollectionCount(),
    ])
    setRecentRare(rare)
    setTopCollectorsList(collectors)
    setUserCardStats(ucStats)
    setCollectionCount(colCount)
    setLoading(false)
  }

  // Parsed config values
  const totalPacks = config?.total_packs || 9999
  const packsPerPool = Math.floor(totalPacks / 3)
  const cardsPerPack = config?.cards_per_pack || CARDS_PER_PACK
  const copiesPerRarity = config?.copies_per_rarity || { rainbow: 1, diamond: 60, gold: 120, rare: 360 }
  const slotWeights = config?.slot_weights || Array.from({ length: 4 }, () => ({ rainbow: 0, diamond: 0, gold: 0, rare: 0 }))
  const noCommonSlots = config?.no_common_slots || [false, false, false, false]

  // Cards grouped by rarity (per pool = same structure for each)
  const cardsByRarity = useMemo(() => {
    const grouped = {}
    for (const c of cards) {
      if (!grouped[c.rarity]) grouped[c.rarity] = []
      grouped[c.rarity].push(c)
    }
    return grouped
  }, [cards])

  // Per-pool card counts by rarity
  const perPoolCardsByRarity = useMemo(() => {
    const result = {}
    for (const pt of PACK_TYPES) {
      const poolCards = cards.filter(c => c.pack_type === pt.id)
      const grouped = {}
      for (const c of poolCards) {
        if (!grouped[c.rarity]) grouped[c.rarity] = []
        grouped[c.rarity].push(c.number)
      }
      result[pt.id] = grouped
    }
    return result
  }, [cards])

  // Supply per rarity (per pool, since config is uniform)
  const supply = useMemo(() => {
    const s = {}
    // Use the first pool's card counts (all pools identical)
    const poolCards = perPoolCardsByRarity.red || {}
    for (const r of NON_COMMON_RARITIES) {
      const count = poolCards[r]?.length || 0
      s[r] = count * (copiesPerRarity[r] || 0)
    }
    const totalSlots = packsPerPool * cardsPerPack
    const nonCommonTotal = Object.values(s).reduce((a, b) => a + b, 0)
    s.common = totalSlots - nonCommonTotal
    return s
  }, [perPoolCardsByRarity, copiesPerRarity, packsPerPool, cardsPerPack])

  const commonPerCard = useMemo(() => {
    const count = perPoolCardsByRarity.red?.common?.length || 20
    return count > 0 ? supply.common / count : 0
  }, [supply, perPoolCardsByRarity])

  // Allocation per slot per rarity
  const allocation = useMemo(() => {
    const alloc = Array.from({ length: cardsPerPack }, () => ({}))
    for (const rarity of NON_COMMON_RARITIES) {
      const total = supply[rarity]
      const weights = slotWeights.map(sw => sw[rarity] || 0)
      const totalWeight = weights.reduce((a, b) => a + b, 0)
      if (totalWeight === 0) {
        for (let s = 0; s < cardsPerPack; s++) alloc[s][rarity] = 0
        alloc[cardsPerPack - 1][rarity] = total
      } else {
        let remaining = total
        for (let s = 0; s < cardsPerPack; s++) {
          if (s === cardsPerPack - 1) {
            alloc[s][rarity] = remaining
          } else {
            const count = Math.round(total * weights[s] / totalWeight)
            alloc[s][rarity] = count
            remaining -= count
          }
        }
      }
    }
    for (let s = 0; s < cardsPerPack; s++) {
      const nonCommon = NON_COMMON_RARITIES.reduce((sum, r) => sum + (alloc[s][r] || 0), 0)
      alloc[s].common = noCommonSlots[s] ? 0 : (packsPerPool - nonCommon)
    }
    return alloc
  }, [supply, slotWeights, packsPerPool, cardsPerPack, noCommonSlots])

  // Diagnostics
  const slotDiag = useMemo(() => {
    return Array.from({ length: cardsPerPack }, (_, s) => {
      const nonCommon = NON_COMMON_RARITIES.reduce((sum, r) => sum + (allocation[s][r] || 0), 0)
      const common = allocation[s].common || 0
      const total = nonCommon + common
      const deficit = noCommonSlots[s] ? (packsPerPool - nonCommon) : 0
      return { nonCommon, common, total, deficit, noCommon: noCommonSlots[s] }
    })
  }, [allocation, noCommonSlots, packsPerPool, cardsPerPack])

  const autoFixSuggestion = useMemo(() => {
    const totalDeficit = slotDiag.reduce((sum, d) => sum + Math.max(0, d.deficit), 0)
    if (totalDeficit === 0) return null
    const rareCards = perPoolCardsByRarity.red?.rare?.length || 8
    const currentRare = copiesPerRarity.rare || 360
    const neededExtra = totalDeficit
    const newRare = currentRare + Math.ceil(neededExtra / rareCards)
    return { deficit: totalDeficit, rarity: 'rare', current: currentRare, suggested: newRare, extra: (newRare - currentRare) * rareCards }
  }, [slotDiag, perPoolCardsByRarity, copiesPerRarity])

  // Validation
  const errors = useMemo(() => {
    const errs = []
    if (supply.common < 0) errs.push('Non-common cards exceed total slot count. Reduce copies.')
    for (let s = 0; s < cardsPerPack; s++) {
      const d = slotDiag[s]
      if (d.total !== packsPerPool && !d.noCommon) {
        errs.push(`Slot ${s + 1}: total ${d.total.toLocaleString()} instead of ${packsPerPool.toLocaleString()}`)
      }
      if (d.noCommon && d.deficit > 0) {
        errs.push(`Slot ${s + 1}: missing ${d.deficit.toLocaleString()} non-common cards`)
      }
    }
    return errs
  }, [supply, slotDiag, packsPerPool, cardsPerPack])

  const hasDeficit = slotDiag.some(d => d.deficit > 0)

  // Setters
  const setCopies = (rarity, val) => {
    const v = Math.max(0, parseInt(val) || 0)
    setConfig(prev => ({ ...prev, copies_per_rarity: { ...prev.copies_per_rarity, [rarity]: v } }))
  }
  const setWeight = (slotIdx, rarity, val) => {
    const v = Math.max(0, parseFloat(val) || 0)
    setConfig(prev => {
      const newWeights = [...prev.slot_weights]
      newWeights[slotIdx] = { ...newWeights[slotIdx], [rarity]: v }
      return { ...prev, slot_weights: newWeights }
    })
  }
  const setTotalPacks = (val) => {
    const v = Math.max(3, parseInt(val) || 9999)
    const rounded = Math.floor(v / 3) * 3
    setConfig(prev => ({ ...prev, total_packs: rounded }))
  }
  const toggleNoCommon = (slotIdx) => {
    setConfig(prev => {
      const newSlots = [...(prev.no_common_slots || [false, false, false, false])]
      newSlots[slotIdx] = !newSlots[slotIdx]
      return { ...prev, no_common_slots: newSlots }
    })
  }
  const applyAutoFix = () => {
    if (!autoFixSuggestion) return
    setCopies(autoFixSuggestion.rarity, autoFixSuggestion.suggested)
  }

  // Save
  const handleSave = async () => {
    setSaving(true)
    const { error } = await savePackConfig({
      total_packs: config.total_packs,
      cards_per_pack: config.cards_per_pack,
      copies_per_rarity: config.copies_per_rarity,
      slot_weights: config.slot_weights,
      no_common_slots: config.no_common_slots,
    })
    setSaving(false)
    if (error) addToast(`Save error: ${error.message}`, 'error')
    else addToast('Configuration saved', 'success')
  }

  // Generate with confirmation
  const handleGenerate = () => {
    if (tcgGameActive) {
      addToast('Game in progress — cannot generate packs', 'error')
      return
    }
    if (errors.length > 0) {
      addToast('Fix errors before generating', 'error')
      return
    }

    const message = stats.total > 0
      ? `You are about to REGENERATE all packs. This will delete the ${stats.total.toLocaleString()} existing packs (including opened ones) and generate ${totalPacks.toLocaleString()} new ones (${packsPerPool.toLocaleString()} per pool). Proceed?`
      : `You are about to generate ${totalPacks.toLocaleString()} packs (${packsPerPool.toLocaleString()} per pool). Proceed?`

    if (requestConfirm) {
      requestConfirm(message, doGenerate)
    } else {
      doGenerate()
    }
  }

  const doGenerate = async () => {
    if (tcgGameActive) {
      addToast('Game in progress — cannot generate packs', 'error')
      return
    }
    setGenerating(true)
    setGenProgress(0)

    try {
      await savePackConfig({
        total_packs: config.total_packs,
        cards_per_pack: config.cards_per_pack,
        copies_per_rarity: config.copies_per_rarity,
        slot_weights: config.slot_weights,
        no_common_slots: config.no_common_slots,
      })

      if (stats.total > 0) await deleteAllGeneratedPacks()

      const RARITY_RANK = { common: 0, rare: 1, gold: 2, diamond: 3, rainbow: 4 }
      const cardRarityRank = {}
      for (const c of cards) cardRarityRank[c.number] = RARITY_RANK[c.rarity] || 0

      const allPacks = []

      // Generate per pool
      for (const pt of PACK_TYPES) {
        const poolCards = perPoolCardsByRarity[pt.id] || {}

        // Build per-slot pools (with copy tracking)
        const slotPools = []
        const copyCounters = {} // { cardNumber: currentCopyIndex }

        for (let s = 0; s < cardsPerPack; s++) {
          const pool = []
          const allRarities = [...NON_COMMON_RARITIES, 'common']
          for (const rarity of allRarities) {
            const count = allocation[s][rarity] || 0
            if (count <= 0) continue
            const rarityCardNums = poolCards[rarity] || []
            if (rarityCardNums.length === 0) continue

            const perCard = Math.floor(count / rarityCardNums.length)
            let extra = count - perCard * rarityCardNums.length

            for (const cardNum of rarityCardNums) {
              const copies = perCard + (extra > 0 ? 1 : 0)
              if (extra > 0) extra--
              if (!copyCounters[cardNum]) copyCounters[cardNum] = 0
              for (let i = 0; i < copies; i++) {
                copyCounters[cardNum]++
                pool.push({ card: cardNum, copy: copyCounters[cardNum] })
              }
            }
          }

          // Fisher-Yates shuffle
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]]
          }
          slotPools.push(pool)
        }

        // Compute total copies per card for the denominator
        const totalCopies = {}
        for (const [cardNum, count] of Object.entries(copyCounters)) {
          totalCopies[cardNum] = count
        }

        // Assemble packs
        for (let i = 0; i < packsPerPool; i++) {
          const packCards = slotPools.map(pool => pool[i])
          // Sort by rarity ascending (common first, rainbow last = hype card)
          packCards.sort((a, b) => (cardRarityRank[a.card] || 0) - (cardRarityRank[b.card] || 0))
          allPacks.push({
            pack_number: i + 1,
            pack_type: pt.id,
            cards: packCards,
          })
        }
      }

      // Batch insert all packs
      const BATCH = 500
      for (let i = 0; i < allPacks.length; i += BATCH) {
        const batch = allPacks.slice(i, i + BATCH)
        const { error } = await insertGeneratedPacks(batch)
        if (error) {
          addToast(`Batch insert error ${i}: ${error.message || error}`, 'error')
          setGenerating(false)
          return
        }
        setGenProgress(Math.min(100, Math.round((i + batch.length) / allPacks.length * 100)))
      }

      await savePackConfig({ generated: true, generated_at: new Date().toISOString() })
      addToast(`${totalPacks.toLocaleString()} packs generated (${packsPerPool.toLocaleString()} x 3 pools)!`, 'success')
      await loadAll()
    } catch (err) {
      addToast(`Generation error: ${err.message}`, 'error')
    }
    setGenerating(false)
  }

  if (loading || !config) {
    return <div style={{ padding: 40, color: DARK.muted, textAlign: 'center' }}>Loading configuration...</div>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Admin tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: DARK.card, borderRadius: 12, padding: 3, width: 'fit-content', border: `1px solid ${DARK.cardBorder}` }}>
        {adminTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s',
              background: tab === t.id ? ACCENT : 'transparent',
              color: tab === t.id ? '#fff' : DARK.muted,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ SYSTEM MANAGER TAB ═══ */}
      {tab === 'system' && (
        <SystemManagerTab
          tcgGameActive={tcgGameActive}
          onGameStateChange={onGameStateChange}
          stats={stats}
          cards={cards}
          remaining={remaining}
          addToast={addToast}
          onReload={loadAll}
          collectionCount={collectionCount}
          requestConfirm={requestConfirm}
        />
      )}

      {/* ═══ GENERATION TAB ═══ */}
      {tab === 'generation' && (
        <>
          {/* Game active warning */}
          {tcgGameActive && (
            <div style={{
              background: `${DARK.danger}15`, border: `1.5px solid ${DARK.danger}50`, borderRadius: 14,
              padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>🚫</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: DARK.danger }}>GAME IN PROGRESS</div>
                <div style={{ fontSize: 12, color: DARK.muted, marginTop: 2 }}>
                  You cannot generate or delete packs while the game is active. End the game from the System Manager to modify packs.
                </div>
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Packs generated', value: stats.total.toLocaleString(), color: ACCENT },
              { label: 'Assigned', value: stats.assigned.toLocaleString(), color: '#F59E0B' },
              { label: 'Opened', value: stats.opened.toLocaleString(), color: DARK.success },
            ].map(s => (
              <div key={s.label} style={{
                background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 14, padding: '16px 20px',
                borderLeft: `3px solid ${s.color}`,
              }}>
                <div style={{ fontSize: 11, color: DARK.muted, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: DARK.text }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Config */}
          <Section title="Pack configuration">
            <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
              <InputField label="Total packs (multiple of 3)" value={totalPacks} onChange={e => setTotalPacks(e.target.value)} width={180} />
              <InputField label="Per pool" value={packsPerPool} disabled width={100} />
              <InputField label="Cards per pack" value={cardsPerPack} disabled width={100} />
            </div>
          </Section>

          {/* Rarity copies */}
          <Section title="Copies per rarity (per single card, per pool)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 80px 100px 100px', gap: 8, padding: '8px 0', borderBottom: `1px solid ${DARK.cardBorder}` }}>
                <span style={thStyle}>Rarity</span>
                <span style={thStyle}>Cards/pool</span>
                <span style={thStyle}>Copies/card</span>
                <span style={thStyle}>Total/pool</span>
              </div>
              {PACK_RARITIES.map(r => {
                const cardCount = perPoolCardsByRarity.red?.[r.id]?.length || 0
                const isCommon = r.id === 'common'
                const copies = isCommon ? commonPerCard : (copiesPerRarity[r.id] || 0)
                const total = supply[r.id] || 0
                return (
                  <div key={r.id} style={{
                    display: 'grid', gridTemplateColumns: '120px 80px 100px 100px', gap: 8, padding: '10px 0',
                    borderBottom: `1px solid ${DARK.inputBorder}`, alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: RARITY_COLORS[r.id] }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: DARK.text }}>{r.label}</span>
                    </div>
                    <span style={{ fontSize: 13, color: DARK.dim }}>{cardCount}</span>
                    {isCommon ? (
                      <span style={{ fontSize: 12, color: DARK.muted, fontStyle: 'italic' }}>~{Math.round(copies)}</span>
                    ) : (
                      <input type="number" min="0" value={copiesPerRarity[r.id] || 0}
                        onChange={e => setCopies(r.id, e.target.value)} style={inputSmallStyle} />
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600, color: total < 0 ? DARK.danger : DARK.text }}>
                      {total.toLocaleString()}
                    </span>
                  </div>
                )
              })}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 80px 100px 100px', gap: 8, padding: '10px 0', borderTop: `2px solid ${DARK.cardBorder}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: DARK.text }}>Total</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: DARK.dim }}>40</span>
                <span />
                <span style={{ fontSize: 13, fontWeight: 700, color: DARK.text }}>
                  {(packsPerPool * cardsPerPack).toLocaleString()} slots
                </span>
              </div>
            </div>
          </Section>

          {/* Slot weights */}
          <Section title="Slot weight distribution">
            <p style={{ fontSize: 12, color: DARK.muted, margin: '-8px 0 16px', lineHeight: 1.5 }}>
              Relative weights to distribute non-common cards across slots. Applied uniformly to all 3 pools.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${cardsPerPack}, 1fr)`, gap: 8, minWidth: 500 }}>
                <span style={thStyle} />
                {Array.from({ length: cardsPerPack }, (_, i) => (
                  <span key={i} style={{ ...thStyle, textAlign: 'center' }}>Slot {i + 1}</span>
                ))}

                {NON_COMMON_RARITIES.map(rarity => (
                  <WeightRow key={rarity} rarity={rarity} slotWeights={slotWeights}
                    cardsPerPack={cardsPerPack} onChangeWeight={setWeight} />
                ))}

                {/* Common toggle row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: RARITY_COLORS.common }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: DARK.dim }}>Common</span>
                </div>
                {Array.from({ length: cardsPerPack }, (_, s) => (
                  <div key={s} style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => toggleNoCommon(s)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: noCommonSlots[s] ? `1.5px solid ${DARK.danger}50` : `1.5px solid ${DARK.success}50`,
                        background: noCommonSlots[s] ? `${DARK.danger}15` : `${DARK.success}15`,
                        color: noCommonSlots[s] ? DARK.danger : DARK.success,
                        transition: 'all 0.2s',
                      }}
                    >
                      {noCommonSlots[s] ? 'ZERO' : 'auto-fill'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Auto-fix */}
          {hasDeficit && autoFixSuggestion && (
            <div style={{
              background: '#F59E0B15', border: `1px solid #F59E0B40`, borderRadius: 14, padding: '16px 20px',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>💡</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B' }}>Balancing needed</span>
              </div>
              <div style={{ fontSize: 12, color: DARK.muted, lineHeight: 1.6 }}>
                To remove Commons from slots marked "ZERO", <strong style={{ color: DARK.text }}>{autoFixSuggestion.deficit.toLocaleString()}</strong> additional
                non-common cards per pool are needed.<br />
                Suggestion: increase <strong style={{ color: RARITY_COLORS[autoFixSuggestion.rarity] }}>
                {RARITY_LABELS[autoFixSuggestion.rarity]}</strong> from <strong style={{ color: DARK.text }}>{autoFixSuggestion.current}</strong> to <strong style={{ color: DARK.text }}>
                {autoFixSuggestion.suggested}</strong> copies/card (+{autoFixSuggestion.extra.toLocaleString()} cards/pool).
              </div>
              <button onClick={applyAutoFix} style={{
                marginTop: 10, padding: '6px 16px', borderRadius: 8, border: '1.5px solid #F59E0B',
                background: '#F59E0B20', color: '#F59E0B', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                Apply suggestion
              </button>
            </div>
          )}

          {/* Preview */}
          <Section title="Distribution preview (per pool)">
            {errors.length > 0 && (
              <div style={{
                background: `${DARK.danger}15`, border: `1px solid ${DARK.danger}40`, borderRadius: 10, padding: '10px 14px',
                marginBottom: 14, fontSize: 12, color: DARK.danger,
              }}>
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${cardsPerPack}, 1fr)`, gap: 6, minWidth: 500 }}>
                <span style={thStyle} />
                {Array.from({ length: cardsPerPack }, (_, i) => (
                  <span key={i} style={{ ...thStyle, textAlign: 'center' }}>
                    Slot {i + 1}
                    {noCommonSlots[i] && <span style={{ color: DARK.danger, marginLeft: 3 }}>★</span>}
                  </span>
                ))}
                {[...NON_COMMON_RARITIES, 'common'].map(rarity => (
                  <PreviewRow key={rarity} rarity={rarity} allocation={allocation}
                    totalPacks={packsPerPool} cardsPerPack={cardsPerPack} noCommonSlots={noCommonSlots} />
                ))}
                <span style={{ fontSize: 12, fontWeight: 700, color: DARK.text }}>Total</span>
                {slotDiag.map((d, s) => {
                  const ok = d.total === packsPerPool
                  const hasIssue = d.noCommon && d.deficit > 0
                  return (
                    <div key={s} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: hasIssue ? DARK.danger : ok ? DARK.success : DARK.danger }}>
                        {d.total.toLocaleString()}{ok && !hasIssue ? ' ✓' : ''}
                      </div>
                      {hasIssue && <div style={{ fontSize: 10, color: DARK.danger, fontWeight: 600 }}>-{d.deficit.toLocaleString()}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </Section>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <button onClick={handleSave} disabled={saving || tcgGameActive} style={{ ...btnSecondary, opacity: tcgGameActive ? 0.4 : 1, cursor: tcgGameActive ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save configuration'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || errors.length > 0 || tcgGameActive}
              style={{ ...btnPrimary, opacity: (generating || errors.length > 0 || tcgGameActive) ? 0.4 : 1, cursor: tcgGameActive ? 'not-allowed' : 'pointer' }}
            >
              {tcgGameActive
                ? '🔒 Game in progress'
                : generating
                  ? `Generating... ${genProgress}%`
                  : stats.total > 0
                    ? `Regenerate ${totalPacks.toLocaleString()} packs`
                    : `Generate ${totalPacks.toLocaleString()} packs`}
            </button>
            {stats.total > 0 && !tcgGameActive && (
              <button
                onClick={() => {
                  if (requestConfirm) {
                    requestConfirm('Delete ALL generated packs? This action is irreversible.', async () => {
                      await deleteAllGeneratedPacks()
                      await savePackConfig({ generated: false, generated_at: null })
                      addToast('Packs deleted', 'success')
                      loadAll()
                    })
                  }
                }}
                style={{ ...btnSecondary, color: DARK.danger, borderColor: `${DARK.danger}40` }}
              >
                Delete packs
              </button>
            )}
          </div>

          {generating && (
            <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: DARK.cardBorder, overflow: 'hidden' }}>
              <div style={{
                width: `${genProgress}%`, height: '100%', borderRadius: 3,
                background: `linear-gradient(90deg, ${ACCENT}, #F5B862)`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
        </>
      )}

      {/* ═══ STATS TAB ═══ */}
      {tab === 'stats' && (() => {
        // Computed stats
        const totalCardsFound = userCardStats.length
        const uniqueCollectors = [...new Set(userCardStats.map(u => u.user_id))].length
        const openPct = stats.total > 0 ? ((stats.opened / stats.total) * 100).toFixed(1) : '0'

        // Cards found per rarity
        const cardsByNum = {}
        for (const c of cards) cardsByNum[c.number] = c
        const foundByRarity = { rainbow: 0, diamond: 0, gold: 0, rare: 0, common: 0 }
        for (const uc of userCardStats) {
          const c = cardsByNum[uc.card_number]
          if (c) foundByRarity[c.rarity] = (foundByRarity[c.rarity] || 0) + 1
        }
        const totalSupply = Object.values(foundByRarity).reduce((a, b) => a + b, 0) || 1

        // Unique cards found (across all users)
        const uniqueCardsFound = new Set(userCardStats.map(u => u.card_number)).size

        // Most popular cards
        const cardPopularity = {}
        for (const uc of userCardStats) {
          cardPopularity[uc.card_number] = (cardPopularity[uc.card_number] || 0) + 1
        }
        const mostPopular = Object.entries(cardPopularity)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([num, count]) => ({ card: cardsByNum[Number(num)], count }))
          .filter(x => x.card)

        // Never found cards
        const neverFound = cards.filter(c => !cardPopularity[c.number])

        return (
          <>
            {/* Overview row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Packs opened', value: `${stats.opened.toLocaleString()} / ${stats.total.toLocaleString()}`, sub: `${openPct}%`, color: ACCENT },
                { label: 'Cards found', value: totalCardsFound.toLocaleString(), sub: `${uniqueCardsFound}/${cards.length} unique`, color: DARK.success },
                { label: 'Collectors', value: uniqueCollectors.toLocaleString(), sub: 'active users', color: '#F59E0B' },
                { label: 'Remaining', value: Object.values(remaining).reduce((a, b) => a + b, 0).toLocaleString(), sub: 'unopened packs', color: '#EF4444' },
              ].map(s => (
                <div key={s.label} style={{
                  background: DARK.card, borderRadius: 14, padding: '16px 18px',
                  border: `1px solid ${DARK.cardBorder}`, borderTop: `3px solid ${s.color}`,
                }}>
                  <div style={{ fontSize: 10, color: DARK.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: DARK.text }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: DARK.dim, marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Diamond & Rainbow history + Top collectors side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

              {/* Recent rare finds */}
              <Section title="Latest Diamond & Rainbow finds">
                {recentRare.length === 0 ? (
                  <div style={{ fontSize: 12, color: DARK.dim, textAlign: 'center', padding: 20 }}>
                    No diamond or rainbow cards found yet
                  </div>
                ) : (
                  <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {recentRare.map((find, i) => {
                      const c = cardsByNum[find.card_number]
                      if (!c) return null
                      const rc = RARITY_COLORS[c.rarity]
                      const timeAgo = getTimeAgo(find.obtained_at)
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          borderBottom: `1px solid ${DARK.inputBorder}`,
                          borderLeft: `3px solid ${rc}`,
                          background: i % 2 === 0 ? 'transparent' : `${DARK.input}80`,
                        }}>
                          {/* Card thumbnail */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                            background: c.image_url
                              ? `url(${c.image_url}) center/cover`
                              : `linear-gradient(135deg, ${rc}40, ${rc}10)`,
                            border: `2px solid ${rc}50`,
                          }} />
                          {/* Card info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                fontSize: 9, fontWeight: 700, color: rc, textTransform: 'uppercase',
                                padding: '1px 6px', borderRadius: 4, background: `${rc}20`,
                              }}>
                                {c.rarity === 'rainbow' ? '★ Rainbow' : '◆ Diamond'}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: DARK.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.name || `#${String(c.number).padStart(3, '0')}`}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: DARK.dim, marginTop: 2 }}>
                              {find.user?.full_name || 'Unknown user'}
                              {find.copy_number != null && <span style={{ color: DARK.muted, marginLeft: 4 }}>copy #{find.copy_number}</span>}
                            </div>
                          </div>
                          {/* Time */}
                          <div style={{ fontSize: 10, color: DARK.dim, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {timeAgo}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              {/* Top collectors */}
              <Section title="Top Collectors">
                {topCollectorsList.length === 0 ? (
                  <div style={{ fontSize: 12, color: DARK.dim, textAlign: 'center', padding: 20 }}>
                    No collectors yet
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {topCollectorsList.map((col, i) => {
                      const maxCount = topCollectorsList[0]?.count || 1
                      const barPct = (col.count / maxCount) * 100
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                      return (
                        <div key={col.id || i} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          borderBottom: `1px solid ${DARK.inputBorder}`,
                        }}>
                          <span style={{ fontSize: medal ? 18 : 12, width: 28, textAlign: 'center', color: DARK.dim, fontWeight: 700 }}>
                            {medal || `${i + 1}.`}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: DARK.text, marginBottom: 4 }}>
                              {col.full_name || 'User'}
                            </div>
                            <div style={{ position: 'relative', height: 6, borderRadius: 3, background: DARK.inputBorder, overflow: 'hidden' }}>
                              <div style={{
                                width: `${barPct}%`, height: '100%', borderRadius: 3,
                                background: i === 0 ? 'linear-gradient(90deg, #F59E0B, #EAB308)' : i === 1 ? 'linear-gradient(90deg, #94A3B8, #CBD5E1)' : i === 2 ? 'linear-gradient(90deg, #CD7F32, #DAA520)' : ACCENT,
                                transition: 'width 0.5s ease',
                              }} />
                            </div>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 800, color: DARK.text, minWidth: 32, textAlign: 'right' }}>
                            {col.count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* Rarity distribution */}
            <Section title="Found rarity distribution">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['rainbow', 'diamond', 'gold', 'rare', 'common'].map(r => {
                  const count = foundByRarity[r] || 0
                  const pct = totalSupply > 0 ? (count / totalSupply * 100) : 0
                  const maxPct = Math.max(...Object.values(foundByRarity).map(v => v / totalSupply * 100), 1)
                  const barPct = maxPct > 0 ? (pct / maxPct * 100) : 0
                  return (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 80, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: RARITY_COLORS[r], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: DARK.text }}>{RARITY_LABELS[r]}</span>
                      </div>
                      <div style={{ flex: 1, position: 'relative', height: 20, borderRadius: 6, background: DARK.inputBorder, overflow: 'hidden' }}>
                        <div style={{
                          width: `${barPct}%`, height: '100%', borderRadius: 6,
                          background: `linear-gradient(90deg, ${RARITY_COLORS[r]}CC, ${RARITY_COLORS[r]})`,
                          transition: 'width 0.5s ease',
                          minWidth: count > 0 ? 2 : 0,
                        }} />
                      </div>
                      <div style={{ width: 90, textAlign: 'right' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: DARK.text }}>{count.toLocaleString()}</span>
                        <span style={{ fontSize: 10, color: DARK.dim, marginLeft: 4 }}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>

            {/* Most popular + never found side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

              {/* Most popular cards */}
              <Section title="Most found cards">
                {mostPopular.length === 0 ? (
                  <div style={{ fontSize: 12, color: DARK.dim, textAlign: 'center', padding: 20 }}>No data</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {mostPopular.map((item, i) => {
                      const rc = RARITY_COLORS[item.card.rarity]
                      return (
                        <div key={item.card.number} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                          borderBottom: `1px solid ${DARK.inputBorder}`,
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: DARK.dim, width: 24, textAlign: 'center' }}>{i + 1}</span>
                          <div style={{
                            width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                            background: item.card.image_url
                              ? `url(${item.card.image_url}) center/cover`
                              : `linear-gradient(135deg, ${rc}40, ${rc}10)`,
                            border: `2px solid ${rc}40`,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: DARK.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.card.name || `#${String(item.card.number).padStart(3, '0')}`}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <div style={{ width: 6, height: 6, borderRadius: 2, background: rc }} />
                              <span style={{ fontSize: 9, color: DARK.dim }}>{RARITY_LABELS[item.card.rarity]}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 800, color: DARK.text }}>{item.count}×</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              {/* Never found cards */}
              <Section title={`Never found cards (${neverFound.length})`}>
                {neverFound.length === 0 ? (
                  <div style={{ fontSize: 12, color: DARK.success, textAlign: 'center', padding: 20 }}>
                    All cards have been found at least once! 🎉
                  </div>
                ) : (
                  <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {neverFound.slice(0, 60).map(c => {
                      const rc = RARITY_COLORS[c.rarity]
                      return (
                        <div key={c.number} title={`${c.name || '—'} (${c.rarity})`} style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          background: `${rc}15`, color: rc, border: `1px solid ${rc}30`,
                          cursor: 'default',
                        }}>
                          #{String(c.number).padStart(3, '0')}
                        </div>
                      )
                    })}
                    {neverFound.length > 60 && (
                      <span style={{ fontSize: 10, color: DARK.dim, alignSelf: 'center', marginLeft: 4 }}>
                        +{neverFound.length - 60} more
                      </span>
                    )}
                  </div>
                )}
              </Section>
            </div>

            {/* Per-pool stats */}
            <Section title="Per-pool statistics">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {PACK_TYPES.map(pt => {
                  const ps = perPoolStats[pt.id] || { total: 0, assigned: 0, opened: 0 }
                  const rem = remaining[pt.id] || 0
                  const openPctPool = ps.total > 0 ? ((ps.opened / ps.total) * 100).toFixed(1) : '0'
                  return (
                    <div key={pt.id} style={{
                      background: DARK.input, borderRadius: 14, padding: 18,
                      border: `1px solid ${pt.color}30`, borderTop: `3px solid ${pt.color}`,
                    }}>
                      <div style={{
                        fontSize: 16, fontWeight: 700, color: pt.color, marginBottom: 14,
                        fontFamily: "'Heartbreaker', sans-serif",
                      }}>
                        {pt.label}
                      </div>
                      {[
                        { l: 'Generated', v: ps.total },
                        { l: 'Assigned', v: ps.assigned },
                        { l: 'Opened', v: ps.opened },
                        { l: 'Remaining', v: rem },
                      ].map(row => (
                        <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${DARK.inputBorder}` }}>
                          <span style={{ fontSize: 12, color: DARK.muted }}>{row.l}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: DARK.text }}>{row.v.toLocaleString()}</span>
                        </div>
                      ))}
                      {/* Pool progress bar */}
                      <div style={{ marginTop: 10, position: 'relative', height: 6, borderRadius: 3, background: DARK.inputBorder, overflow: 'hidden' }}>
                        <div style={{
                          width: `${openPctPool}%`, height: '100%', borderRadius: 3,
                          background: `linear-gradient(90deg, ${pt.color}CC, ${pt.color})`,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ fontSize: 10, color: DARK.dim, marginTop: 4, textAlign: 'right' }}>{openPctPool}% opened</div>
                    </div>
                  )
                })}
              </div>
            </Section>

            {/* Card pool breakdown */}
            <Section title="Cards per pool">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {PACK_TYPES.map(pt => {
                  const poolCards = perPoolCardsByRarity[pt.id] || {}
                  return (
                    <div key={pt.id} style={{
                      background: DARK.input, borderRadius: 14, padding: 16,
                      border: `1px solid ${pt.color}30`,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: pt.color, marginBottom: 10, fontFamily: "'Heartbreaker', sans-serif" }}>
                        Pool {pt.label}
                      </div>
                      {PACK_RARITIES.map(r => (
                        <div key={r.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
                        }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: RARITY_COLORS[r.id] }} />
                          <span style={{ fontSize: 11, color: DARK.dim, flex: 1 }}>{r.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: DARK.text }}>{poolCards[r.id]?.length || 0}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: `1px solid ${DARK.inputBorder}`, marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: DARK.muted }}>Total</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: DARK.text }}>
                          {Object.values(poolCards).reduce((a, b) => a + b.length, 0)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          </>
        )
      })()}

      {/* ═══ CARD MANAGER TAB ═══ */}
      {tab === 'cards' && (
        <CardManagerTab cards={cards} addToast={addToast} onReload={loadAll} />
      )}

      {/* ═══ DEBUG TAB ═══ */}
      {tab === 'debug' && !tcgGameActive && (
        <>
          <Section title="🛠 Debug">
            <div style={{ fontSize: 12, color: DARK.muted, lineHeight: 1.6, marginBottom: 20 }}>
              Debug tools for testing. This tab is only available when the game is not active.
            </div>

            {/* Collection status card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRadius: 14, marginBottom: 20,
              background: collectionCount === 0 ? `${DARK.success}10` : `#F59E0B12`,
              border: `1px solid ${collectionCount === 0 ? DARK.success + '30' : '#F59E0B40'}`,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: collectionCount === 0 ? `${DARK.success}20` : '#F59E0B20',
                fontSize: 22,
              }}>
                {collectionCount === 0 ? '✓' : '📦'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: collectionCount === 0 ? DARK.success : '#F59E0B' }}>
                  {collectionCount === 0 ? 'Collections empty' : `${collectionCount?.toLocaleString() || '?'} cards in collections`}
                </div>
                <div style={{ fontSize: 11, color: DARK.muted, marginTop: 3 }}>
                  {collectionCount === 0
                    ? 'All collections have been reset. Ready to start a new game.'
                    : 'Collections contain player and admin cards. Reset before starting a new game.'}
                </div>
              </div>
            </div>

            {/* Reset collections */}
            <div style={{
              background: DARK.input, border: `1px solid ${DARK.inputBorder}`, borderRadius: 14, padding: '20px 22px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>🗑</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: DARK.text }}>Reset Collections</div>
                  <div style={{ fontSize: 11, color: DARK.muted, marginTop: 2 }}>
                    Deletes all cards from all players (including admins), resets timers, and makes all packs available again.
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (requestConfirm) {
                    requestConfirm(
                      'Do you want to reset ALL collections for ALL players (including admins)?\n\n• All cards will be deleted\n• All timers will be reset\n• All opened packs will become available again\n\nThis action is irreversible.',
                      async () => {
                        try {
                          const { error: e1 } = await resetAllUserCards()
                          if (e1) throw new Error('Card reset error: ' + e1.message)
                          const { error: e2 } = await resetAllUserTimers()
                          if (e2) throw new Error('Timer reset error: ' + e2.message)
                          const { error: e3 } = await resetAllOpenedPacks()
                          if (e3) throw new Error('Pack reset error: ' + e3.message)
                          addToast('Collections reset — cards, timers, and packs cleared', 'success')
                          loadAll()
                        } catch (err) {
                          addToast(err.message, 'error')
                        }
                      }
                    )
                  }
                }}
                disabled={collectionCount === 0}
                style={{
                  padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: collectionCount === 0 ? 'not-allowed' : 'pointer',
                  border: collectionCount === 0 ? `1.5px solid ${DARK.cardBorder}` : `1.5px solid ${DARK.danger}60`,
                  background: collectionCount === 0 ? DARK.cardBorder : `${DARK.danger}15`,
                  color: collectionCount === 0 ? DARK.dim : DARK.danger,
                  opacity: collectionCount === 0 ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {collectionCount === 0 ? '✓ Collections already empty' : '🗑 Reset all collections'}
              </button>
            </div>
          </Section>
        </>
      )}

      {/* Font import for Heartbreaker */}
      <style>{`
        @font-face {
          font-family: 'Heartbreaker';
          src: url('/fonts/Heartbreaker.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `}</style>
    </div>
  )
}

/* ═══ System Manager Tab ═══ */
function SystemManagerTab({ tcgGameActive, onGameStateChange, stats, cards, remaining, addToast, onReload, collectionCount, requestConfirm }) {
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [stopWord, setStopWord] = useState('')

  const STOP_KEYWORD = 'TERMINATE'

  // Compute actual remaining packs (not yet opened)
  const totalRemaining = Object.values(remaining || {}).reduce((a, b) => a + b, 0)

  // Conditions to start the game
  const packsGenerated = stats.total > 0 && stats.opened === 0
  const cardsConfigured = cards.length === 120
  const cardsWithNames = cards.filter(c => c.name && c.name.trim()).length
  const cardsWithImages = cards.filter(c => c.image_url).length
  const collectionsClean = collectionCount === 0
  const allConditionsMet = packsGenerated && cardsConfigured && collectionsClean

  const handleStartGame = async () => {
    if (!allConditionsMet) {
      addToast('Not all conditions are met', 'error')
      return
    }
    setStarting(true)
    try {
      // 1. Reset all user cards
      const { error: cardErr } = await resetAllUserCards()
      if (cardErr) throw new Error('Card reset error: ' + cardErr.message)

      // 2. Reset all user timers (so everyone starts with 3 packs on first visit)
      const { error: timerErr } = await resetAllUserTimers()
      if (timerErr) throw new Error('Timer reset error: ' + timerErr.message)

      // 3. Reset all opened packs back to available
      const { error: packErr } = await resetAllOpenedPacks()
      if (packErr) throw new Error('Pack reset error: ' + packErr.message)

      // 4. Reset all trade tokens to 0
      const { error: tokenErr } = await resetAllTradeTokens()
      if (tokenErr) throw new Error('Token reset error: ' + tokenErr.message)

      // 5. Activate the game
      const { error: gameErr } = await setTcgGameActive(true)
      if (gameErr) throw new Error('Activation error: ' + gameErr.message)

      onGameStateChange(true)
      addToast('Game started! All players can now access the TCG', 'success')
      onReload()
    } catch (err) {
      addToast(err.message, 'error')
    }
    setStarting(false)
  }

  const handleStopGame = async () => {
    if (stopWord !== STOP_KEYWORD) {
      addToast(`Type "${STOP_KEYWORD}" to confirm`, 'error')
      return
    }
    setStopping(true)
    try {
      const { error } = await setTcgGameActive(false)
      if (error) throw new Error('Error: ' + error.message)

      onGameStateChange(false)
      setStopWord('')
      addToast('Game ended. The TCG is now visible only to admins.', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
    setStopping(false)
  }

  return (
    <>
      {/* Game Status */}
      <Section title="System Manager">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 14, marginBottom: 20,
          background: tcgGameActive ? `${DARK.success}15` : `${DARK.danger}15`,
          border: `1px solid ${tcgGameActive ? DARK.success + '40' : DARK.danger + '40'}`,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: tcgGameActive ? DARK.success : DARK.danger,
            boxShadow: `0 0 12px ${tcgGameActive ? DARK.success : DARK.danger}80`,
            animation: tcgGameActive ? 'sysLive 2s ease-in-out infinite' : 'none',
          }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: tcgGameActive ? DARK.success : DARK.danger }}>
              {tcgGameActive ? 'GAME ACTIVE' : 'GAME NOT ACTIVE'}
            </div>
            <div style={{ fontSize: 11, color: DARK.muted, marginTop: 2 }}>
              {tcgGameActive
                ? 'All users can access the TCG and open packs. Admins cannot open packs.'
                : 'The TCG is visible only to admins. Admins can freely open packs for debugging.'}
            </div>
          </div>
        </div>

        {/* Conditions checklist */}
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: DARK.text, margin: '0 0 12px' }}>Conditions to start the game</h4>
          {[
            { label: 'Packs ready', ok: packsGenerated, detail: stats.total === 0 ? 'No packs generated' : stats.opened > 0 ? `${stats.opened.toLocaleString()} packs already opened — regenerate from the Generation tab` : `${totalRemaining.toLocaleString()} packs ready` },
            { label: '120 cards configured', ok: cardsConfigured, detail: `${cards.length}/120 cards in database` },
            { label: 'Collections reset', ok: collectionsClean, detail: collectionsClean ? 'No cards in collections' : `${collectionCount?.toLocaleString() || '?'} cards present — reset from the Debug tab` },
            { label: 'Cards with name', ok: cardsWithNames >= 120, detail: `${cardsWithNames}/120 cards with name`, optional: true },
            { label: 'Cards with image', ok: cardsWithImages >= 120, detail: `${cardsWithImages}/120 cards with image`, optional: true },
          ].map((cond, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: `1px solid ${DARK.inputBorder}`,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: cond.ok ? `${DARK.success}20` : cond.optional ? `#F59E0B20` : `${DARK.danger}20`,
                color: cond.ok ? DARK.success : cond.optional ? '#F59E0B' : DARK.danger,
                fontSize: 12, fontWeight: 700,
              }}>
                {cond.ok ? '✓' : cond.optional ? '○' : '✗'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: DARK.text }}>
                  {cond.label}
                  {cond.optional && <span style={{ fontSize: 10, color: DARK.dim, marginLeft: 6 }}>(optional)</span>}
                </div>
                <div style={{ fontSize: 11, color: DARK.muted }}>{cond.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        {!tcgGameActive ? (
          <div>
            <button
              onClick={handleStartGame}
              disabled={!allConditionsMet || starting}
              style={{
                padding: '12px 28px', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700,
                cursor: allConditionsMet && !starting ? 'pointer' : 'not-allowed',
                background: allConditionsMet ? 'linear-gradient(135deg, #22C55E, #16A34A)' : DARK.cardBorder,
                color: allConditionsMet ? '#fff' : DARK.dim,
                opacity: starting ? 0.6 : 1,
                boxShadow: allConditionsMet ? '0 4px 16px rgba(34,197,94,0.3)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {starting ? 'Starting...' : '▶ Start Game'}
            </button>
            <div style={{ fontSize: 11, color: DARK.muted, marginTop: 8, lineHeight: 1.5 }}>
              Starting the game will make the TCG visible to everyone, reset all player cards, and give each player 3 initial packs.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: DARK.danger, display: 'block', marginBottom: 6 }}>
                To end the game, type <strong>{STOP_KEYWORD}</strong> and press the button
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={stopWord}
                  onChange={e => setStopWord(e.target.value)}
                  placeholder={STOP_KEYWORD}
                  style={{
                    padding: '10px 14px', borderRadius: 10,
                    border: `2px solid ${stopWord === STOP_KEYWORD ? DARK.danger : DARK.inputBorder}`,
                    background: DARK.input, color: DARK.text,
                    fontSize: 16, fontWeight: 800, fontFamily: 'monospace',
                    letterSpacing: 2, width: 180, outline: 'none',
                    textTransform: 'uppercase',
                    transition: 'border-color 0.2s',
                  }}
                />
                <button
                  onClick={handleStopGame}
                  disabled={stopWord !== STOP_KEYWORD || stopping}
                  style={{
                    padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    cursor: stopWord === STOP_KEYWORD && !stopping ? 'pointer' : 'not-allowed',
                    background: stopWord === STOP_KEYWORD ? DARK.danger : DARK.cardBorder,
                    color: stopWord === STOP_KEYWORD ? '#fff' : DARK.dim,
                    border: 'none', opacity: stopping ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {stopping ? 'Stopping...' : '■ End Game'}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: DARK.muted, lineHeight: 1.5 }}>
              Ending the game will hide the TCG from everyone except admins. User cards will remain but the game will no longer be active.
            </div>
          </div>
        )}
      </Section>

      <style>{`
        @keyframes sysLive {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </>
  )
}

/* ═══ Card Manager Tab ═══ */
function CardManagerTab({ cards, addToast, onReload }) {
  const [search, setSearch] = useState('')
  const [poolFilter, setPoolFilter] = useState('all')
  const [rarityFilter, setRarityFilter] = useState('all')
  const [editing, setEditing] = useState(null) // card number being edited
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editImagePos, setEditImagePos] = useState({ x: 50, y: 50, scale: 100 })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState(null) // local preview URL
  const fileInputRef = useRef(null)

  // Image positioning state
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const posRef = useRef({ x: 50, y: 50 })
  const frameRef = useRef(null)

  const filtered = useMemo(() => {
    let list = [...cards]
    if (poolFilter !== 'all') list = list.filter(c => c.pack_type === poolFilter)
    if (rarityFilter !== 'all') list = list.filter(c => c.rarity === rarityFilter)
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(c =>
        String(c.number).includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => a.number - b.number)
  }, [cards, poolFilter, rarityFilter, search])

  const startEdit = (card) => {
    setEditing(card.number)
    setEditName(card.name || '')
    setEditDesc(card.description || '')
    setEditImageUrl(card.image_url || '')
    setEditImagePos(card.image_position || { x: 50, y: 50, scale: 100 })
    posRef.current = card.image_position ? { x: card.image_position.x, y: card.image_position.y } : { x: 50, y: 50 }
    setPreviewImage(null)
  }

  const handleSave = async () => {
    setSaving(true)
    const updates = {
      name: editName,
      description: editDesc,
      image_url: editImageUrl,
      image_position: editImagePos,
    }
    const { error } = await updatePackCard(editing, updates)
    setSaving(false)
    if (error) {
      addToast(`Error: ${error.message}`, 'error')
    } else {
      addToast('Card updated!', 'success')
      setEditing(null)
      onReload()
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Show local preview
    setPreviewImage(URL.createObjectURL(file))
    setUploading(true)
    const { url, error } = await uploadCardImage(editing, file)
    setUploading(false)
    if (error) {
      addToast(`Upload error: ${error.message}`, 'error')
      setPreviewImage(null)
    } else {
      setEditImageUrl(url)
      addToast('Image uploaded', 'success')
    }
  }

  // Image positioning: drag to pan
  const handlePosMouseDown = (e) => {
    e.preventDefault()
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    posRef.current = { x: editImagePos.x, y: editImagePos.y }
  }

  const handlePosMouseMove = useCallback((e) => {
    if (!dragging || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const dx = ((e.clientX - dragStart.x) / rect.width) * -100
    const dy = ((e.clientY - dragStart.y) / rect.height) * -100
    const newX = Math.max(0, Math.min(100, posRef.current.x + dx))
    const newY = Math.max(0, Math.min(100, posRef.current.y + dy))
    setEditImagePos(prev => ({ ...prev, x: newX, y: newY }))
  }, [dragging, dragStart])

  const handlePosMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handlePosMouseMove)
      window.addEventListener('mouseup', handlePosMouseUp)
      return () => {
        window.removeEventListener('mousemove', handlePosMouseMove)
        window.removeEventListener('mouseup', handlePosMouseUp)
      }
    }
  }, [dragging, handlePosMouseMove, handlePosMouseUp])

  // Scroll to zoom
  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -5 : 5
    setEditImagePos(prev => ({ ...prev, scale: Math.max(100, Math.min(300, prev.scale + delta)) }))
  }

  const imageToShow = previewImage || editImageUrl
  const editingCard = cards.find(c => c.number === editing)

  return (
    <>
      {/* Filters */}
      <Section title="Card Manager">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name or number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              ...inputSmallStyle, width: 220, padding: '8px 12px',
            }}
          />
          <div style={{ display: 'flex', gap: 3, background: DARK.input, borderRadius: 8, padding: 2 }}>
            {['all', 'red', 'green', 'blue'].map(p => (
              <button key={p} onClick={() => setPoolFilter(p)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', background: poolFilter === p ? (PACK_TYPES.find(t => t.id === p)?.color || ACCENT) : 'transparent',
                color: poolFilter === p ? '#fff' : DARK.muted,
              }}>
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3, background: DARK.input, borderRadius: 8, padding: 2 }}>
            {['all', 'rainbow', 'diamond', 'gold', 'rare', 'common'].map(r => (
              <button key={r} onClick={() => setRarityFilter(r)} style={{
                padding: '5px 10px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 600,
                cursor: 'pointer', background: rarityFilter === r ? (RARITY_COLORS[r] || ACCENT) : 'transparent',
                color: rarityFilter === r ? '#fff' : DARK.muted,
              }}>
                {r === 'all' ? 'All' : RARITY_LABELS[r]}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: DARK.dim, marginLeft: 'auto' }}>
            {filtered.length} cards
          </span>
        </div>

        {/* Card list */}
        <div style={{ maxHeight: 500, overflowY: 'auto', borderRadius: 10, border: `1px solid ${DARK.inputBorder}` }}>
          {filtered.map(card => {
            const rc = RARITY_COLORS[card.rarity] || RARITY_COLORS.common
            const isEditing = editing === card.number
            const pt = PACK_TYPES.find(t => t.id === card.pack_type)
            return (
              <div
                key={card.number}
                onClick={() => !isEditing && startEdit(card)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  borderBottom: `1px solid ${DARK.inputBorder}`,
                  background: isEditing ? `${ACCENT}10` : 'transparent',
                  cursor: isEditing ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = DARK.cardHover }}
                onMouseLeave={e => { if (!isEditing) e.currentTarget.style.background = isEditing ? `${ACCENT}10` : 'transparent' }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: 48, height: 48, borderRadius: 8, flexShrink: 0,
                  background: card.image_url
                    ? `url(${card.image_url}) center/cover no-repeat`
                    : `linear-gradient(135deg, ${DARK.card}, ${DARK.input})`,
                  border: `2px solid ${rc}40`,
                }} />
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: DARK.text, fontFamily: 'monospace' }}>
                      #{String(card.number).padStart(3, '0')}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: DARK.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.name || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: rc, textTransform: 'uppercase',
                      padding: '1px 6px', borderRadius: 4, background: `${rc}20`,
                    }}>
                      {RARITY_LABELS[card.rarity]}
                    </span>
                    {pt && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: pt.color,
                        padding: '1px 6px', borderRadius: 4, background: `${pt.color}20`,
                      }}>
                        {pt.label}
                      </span>
                    )}
                    {card.image_url && (
                      <span style={{ fontSize: 9, color: DARK.success }}>✓ img</span>
                    )}
                  </div>
                </div>
                {/* Edit indicator */}
                <div style={{ fontSize: 11, color: DARK.dim }}>
                  {isEditing ? '▼' : '›'}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Edit panel — shown when a card is selected */}
      {editing != null && editingCard && (
        <Section title={`Edit #${String(editing).padStart(3, '0')} — ${editName || editingCard.name || 'Unnamed'}`}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {/* Left: form fields */}
            <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: DARK.dim, display: 'block', marginBottom: 4 }}>Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ ...inputSmallStyle, width: '100%', padding: '8px 12px' }}
                  placeholder="Card name"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: DARK.dim, display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  style={{
                    ...inputSmallStyle, width: '100%', padding: '8px 12px',
                    resize: 'vertical', fontFamily: 'inherit',
                  }}
                  placeholder="Card description"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: DARK.dim, display: 'block', marginBottom: 4 }}>Image</label>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    ...btnSecondary, padding: '8px 16px', fontSize: 12,
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  {uploading ? 'Uploading...' : imageToShow ? 'Change image' : 'Upload image'}
                </button>
                {editImageUrl && (
                  <span style={{ fontSize: 10, color: DARK.success, marginLeft: 8 }}>✓ Image uploaded</span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, padding: '8px 20px', fontSize: 12, opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(null)} style={{ ...btnSecondary, padding: '8px 20px', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            </div>

            {/* Right: image positioning + preview */}
            <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: DARK.dim }}>Preview & Positioning</label>

              {/* Positioning frame — FullArt (diamond/rainbow) shows full card, others show top 55% */}
              <div
                ref={frameRef}
                onMouseDown={imageToShow ? handlePosMouseDown : undefined}
                onWheel={imageToShow ? handleWheel : undefined}
                style={{
                  width: '100%',
                  aspectRatio: (editingCard.rarity === 'diamond' || editingCard.rarity === 'rainbow') ? '2.5 / 3.5' : '2.5 / 1.925',
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: `2px solid ${RARITY_COLORS[editingCard.rarity] || DARK.inputBorder}`,
                  background: imageToShow
                    ? undefined
                    : `linear-gradient(135deg, ${DARK.card}, ${DARK.input})`,
                  backgroundImage: imageToShow ? `url(${imageToShow})` : undefined,
                  backgroundPosition: imageToShow ? `${editImagePos.x}% ${editImagePos.y}%` : undefined,
                  backgroundSize: imageToShow ? `${editImagePos.scale}%` : undefined,
                  backgroundRepeat: 'no-repeat',
                  cursor: imageToShow ? (dragging ? 'grabbing' : 'grab') : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  userSelect: 'none', WebkitUserSelect: 'none',
                }}
              >
                {!imageToShow && (
                  <span style={{ fontSize: 11, color: DARK.dim }}>No image</span>
                )}
              </div>

              {imageToShow && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: DARK.dim }}>Zoom:</span>
                  <input
                    type="range" min="100" max="300" value={editImagePos.scale}
                    onChange={e => setEditImagePos(prev => ({ ...prev, scale: Number(e.target.value) }))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 10, color: DARK.muted, fontFamily: 'monospace', width: 36 }}>
                    {editImagePos.scale}%
                  </span>
                </div>
              )}

              {imageToShow && (
                <button
                  onClick={() => setEditImagePos({ x: 50, y: 50, scale: 100 })}
                  style={{ ...btnSecondary, padding: '4px 10px', fontSize: 10 }}
                >
                  Reset position
                </button>
              )}

              <div style={{ fontSize: 9, color: DARK.dim, lineHeight: 1.4 }}>
                Drag to move, scroll to zoom.
                The visible area corresponds to the card frame in the collection.
              </div>
            </div>
          </div>
        </Section>
      )}
    </>
  )
}

function WeightRow({ rarity, slotWeights, cardsPerPack, onChangeWeight }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: RARITY_COLORS[rarity] }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: DARK.text }}>{RARITY_LABELS[rarity]}</span>
      </div>
      {Array.from({ length: cardsPerPack }, (_, s) => (
        <input key={s} type="number" min="0" step="1"
          value={slotWeights[s]?.[rarity] || 0}
          onChange={e => onChangeWeight(s, rarity, e.target.value)}
          style={{ ...inputSmallStyle, textAlign: 'center' }} />
      ))}
    </>
  )
}

function PreviewRow({ rarity, allocation, totalPacks, cardsPerPack, noCommonSlots }) {
  const isCommon = rarity === 'common'
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: RARITY_COLORS[rarity] }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: DARK.dim }}>{RARITY_LABELS[rarity]}</span>
      </div>
      {Array.from({ length: cardsPerPack }, (_, s) => {
        const count = allocation[s]?.[rarity] || 0
        const pct = totalPacks > 0 ? (count / totalPacks * 100) : 0
        const isZero = isCommon && noCommonSlots[s] && count === 0
        const isNeg = count < 0
        return (
          <div key={s} style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: isNeg ? DARK.danger : isZero ? DARK.success : DARK.text,
            }}>
              {isZero ? '0 ✓' : count.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: isNeg ? DARK.danger : DARK.muted }}>
              {pct.toFixed(pct < 1 && pct > 0 ? 2 : 1)}%
            </div>
          </div>
        )
      })}
    </>
  )
}

function Section({ title, children }) {
  return (
    <div style={{
      background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 16,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: DARK.text, margin: '0 0 16px' }}>{title}</h3>
      {children}
    </div>
  )
}

function InputField({ label, value, onChange, disabled, width }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: DARK.dim, display: 'block', marginBottom: 4 }}>{label}</label>
      <input type="number" value={value} onChange={onChange} disabled={disabled}
        style={{
          width: width || '100%', padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${DARK.inputBorder}`,
          fontSize: 13, background: disabled ? DARK.card : DARK.input, color: disabled ? DARK.muted : DARK.text,
          outline: 'none', boxSizing: 'border-box',
        }} />
    </div>
  )
}

const thStyle = { fontSize: 11, fontWeight: 600, color: DARK.muted, textTransform: 'uppercase', letterSpacing: '0.3px' }

const inputSmallStyle = {
  width: '100%', padding: '6px 8px', borderRadius: 8, border: `1.5px solid ${DARK.inputBorder}`,
  fontSize: 13, background: DARK.input, color: DARK.text, outline: 'none', boxSizing: 'border-box',
}

const btnPrimary = {
  padding: '10px 24px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', background: ACCENT, color: '#fff', transition: 'all 0.2s',
}

const btnSecondary = {
  padding: '10px 24px', borderRadius: 10, border: `1.5px solid ${DARK.cardBorder}`, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', background: DARK.card, color: DARK.text, transition: 'all 0.2s',
}
