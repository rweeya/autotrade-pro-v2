import React, { useState, useEffect } from 'react'

interface HistorySignal {
  id: number
  symbol: string
  action: 'buy' | 'sell'
  price: number
  strength: number
  reasons: string
  timestamp: string
}

const SignalHistory: React.FC = () => {
  const [history, setHistory] = useState<HistorySignal[]>([])
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all')

  useEffect(() => {
    const saved = localStorage.getItem('signal_history')
    if (saved) {
      setHistory(JSON.parse(saved))
    }
  }, [])

  const saveToLocalStorage = (newHistory: HistorySignal[]) => {
    localStorage.setItem('signal_history', JSON.stringify(newHistory))
    setHistory(newHistory)
  }

  const deleteSignal = (id: number) => {
    const newHistory = history.filter(s => s.id !== id)
    saveToLocalStorage(newHistory)
  }

  const clearAll = () => {
    if (confirm('Удалить всю историю сигналов?')) {
      saveToLocalStorage([])
    }
  }

  const filteredHistory = history.filter(s => 
    filter === 'all' ? true : s.action === filter
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl ${filter === 'all' ? 'bg-purple-600' : 'bg-black/50'} border border-purple-500/30`}>
          📌 Все ({history.length})
        </button>
        <button onClick={() => setFilter('buy')} className={`px-4 py-2 rounded-xl ${filter === 'buy' ? 'bg-green-600' : 'bg-black/50'} border border-green-500/30`}>
          🟢 BUY ({history.filter(s => s.action === 'buy').length})
        </button>
        <button onClick={() => setFilter('sell')} className={`px-4 py-2 rounded-xl ${filter === 'sell' ? 'bg-red-600' : 'bg-black/50'} border border-red-500/30`}>
          🔴 SELL ({history.filter(s => s.action === 'sell').length})
        </button>
        <button onClick={clearAll} className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/50 hover:bg-red-500/40 transition">
          🗑️ Очистить всё
        </button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="text-center text-gray-500 py-10">История пуста</div>
        ) : (
          filteredHistory.map(signal => (
            <div key={signal.id} className="bg-black/50 rounded-xl p-4 border border-gray-700 flex justify-between items-center">
              <div>
                <div className="flex gap-3 items-center flex-wrap">
                  <span className="font-bold">💰 {signal.symbol}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${signal.action === 'buy' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                    {signal.action === 'buy' ? 'BUY' : 'SELL'}
                  </span>
                  <span className="text-yellow-400 text-xs">⚡ сила: {signal.strength}/5</span>
                </div>
                <div className="text-gray-400 text-sm mt-1">
                  💵 ${signal.price} | 📊 {signal.reasons}
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {new Date(signal.timestamp).toLocaleString()}
                </div>
              </div>
              <button onClick={() => deleteSignal(signal.id)} className="text-red-400 hover:text-red-300 transition px-3 py-1 rounded-lg hover:bg-red-500/20">
                ✖
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SignalHistory