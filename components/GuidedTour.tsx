'use client'

import { useEffect, useState } from 'react'

interface Step {
  target: string
  title: string
  description: string
  side: 'top' | 'right'
}

const STEPS: Step[] = [
  {
    target: 'chat-input',
    title: 'Ask Letizia anything',
    description: 'Type your question here and press Enter. Try it now — ask anything about your business.',
    side: 'top',
  },
  {
    target: 'chat-history',
    title: 'Your conversation history',
    description: 'Every chat is saved here automatically. Tap any conversation to continue where you left off.',
    side: 'right',
  },
  {
    target: 'settings-button',
    title: 'Complete your profile',
    description: 'Fill in your details here — the more Letizia knows about you, the sharper her advice gets.',
    side: 'right',
  },
]

const TOOLTIP_WIDTH = 288
const PAD = 10
const GAP = 18

interface Props {
  step: number
  onNext: () => void
  onDone: () => void
}

export default function GuidedTour({ step, onNext, onDone }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  useEffect(() => {
    setRect(null)
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-tour="${current.target}"]`)
      if (el) setRect(el.getBoundingClientRect())
    }, 320)
    return () => clearTimeout(timer)
  }, [step, current.target])

  if (!rect) return null

  const spotTop = rect.top - PAD
  const spotLeft = rect.left - PAD
  const spotW = rect.width + PAD * 2
  const spotH = rect.height + PAD * 2

  let tooltipStyle: React.CSSProperties
  if (current.side === 'top') {
    const centerX = Math.max(16, Math.min(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 16))
    tooltipStyle = {
      bottom: window.innerHeight - spotTop + GAP,
      left: centerX,
      width: TOOLTIP_WIDTH,
    }
  } else {
    const centerY = Math.max(16, Math.min(rect.top + rect.height / 2 - 90, window.innerHeight - 220))
    tooltipStyle = {
      top: centerY,
      left: spotLeft + spotW + GAP,
      width: TOOLTIP_WIDTH,
    }
  }

  return (
    <>
      {/* Spotlight ring */}
      <div
        style={{
          position: 'fixed',
          top: spotTop,
          left: spotLeft,
          width: spotW,
          height: spotH,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
          border: '2px solid #C5A059',
          borderRadius: 14,
          zIndex: 9998,
          pointerEvents: 'none',
          transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
        }}
      />

      {/* Tooltip card */}
      <div
        style={{ position: 'fixed', zIndex: 9999, ...tooltipStyle }}
        className="bg-white rounded-2xl shadow-2xl p-5"
      >
        {/* Step indicator */}
        <div className="flex gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{ transition: 'width 0.3s, background 0.3s' }}
              className={`h-1.5 rounded-full ${
                i === step
                  ? 'bg-[#C5A059] w-6'
                  : i < step
                  ? 'bg-[#C5A059]/35 w-3'
                  : 'bg-gray-200 w-3'
              }`}
            />
          ))}
        </div>

        <h3 className="text-[#1A2C41] font-semibold text-[15px] mb-1.5">{current.title}</h3>
        <p className="text-[#1A2C41]/55 text-sm leading-relaxed mb-4">{current.description}</p>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[#1A2C41]/30 text-xs">
            {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={isLast ? onDone : onNext}
            className="flex-1 bg-[#1A2C41] hover:bg-[#243d5a] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
          >
            {isLast ? "Let's go →" : 'Next →'}
          </button>
        </div>
      </div>
    </>
  )
}
