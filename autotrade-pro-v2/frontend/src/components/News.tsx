import React, { useState, useEffect } from 'react'

interface NewsItem {
  title: string
  source: string
  published_at: string
  url: string
  votes: {
    positive: number
    negative: number
  }
}

const News: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'hot' | 'bullish' | 'bearish'>('all')

  // ТВОЙ API КЛЮЧ (вставлен)
  const API_KEY = '29f5e28341f44feb8260f8333efa7f8e'

  useEffect(() => {
    fetchNews()
  }, [filter])

  const fetchNews = async () => {
    setLoading(true)
    try {
      let url = `https://cryptopanic.com/api/v1/posts/?auth_token=${API_KEY}&public=true`
      
      if (filter === 'hot') url += '&filter=hot'
      if (filter === 'bullish') url += '&filter=bullish'
      if (filter === 'bearish') url += '&filter=bearish'
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.results) {
        setNews(data.results.slice(0, 20))
      } else {
        // Если API не работает, показываем демо
        useDemoNews()
      }
    } catch (error) {
      console.error('Ошибка загрузки новостей:', error)
      useDemoNews()
    } finally {
      setLoading(false)
    }
  }

  // Демо-новости на случай ошибки
  const useDemoNews = () => {
    const demoNews: NewsItem[] = [
      { title: '🚀 Биткоин обновил максимум на фоне институционального интереса', source: 'CoinDesk', published_at: new Date().toISOString(), url: '#', votes: { positive: 245, negative: 32 } },
      { title: '📈 Ethereum ETF одобрен SEC, цена растет', source: 'Bloomberg', published_at: new Date(Date.now() - 3600000).toISOString(), url: '#', votes: { positive: 189, negative: 45 } },
      { title: '⚠️ Регуляторы ЕС ужесточают требования к криптобиржам', source: 'Reuters', published_at: new Date(Date.now() - 7200000).toISOString(), url: '#', votes: { positive: 67, negative: 234 } },
      { title: '💎 MicroStrategy купила еще 3000 BTC', source: 'CoinTelegraph', published_at: new Date(Date.now() - 10800000).toISOString(), url: '#', votes: { positive: 312, negative: 28 } },
      { title: '🔓 Взлом биржи на $50 млн, последствия для рынка', source: 'CryptoNews', published_at: new Date(Date.now() - 18000000).toISOString(), url: '#', votes: { positive: 23, negative: 567 } },
    ]
    setNews(demoNews)
  }

  const getSentimentColor = (positive: number, negative: number) => {
    if (positive > negative) return 'text-green-400 bg-green-500/20'
    if (negative > positive) return 'text-red-400 bg-red-500/20'
    return 'text-gray-400 bg-gray-500/20'
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60)
    if (diff < 60) return `${diff} мин назад`
    if (diff < 1440) return `${Math.floor(diff / 60)} час назад`
    return `${Math.floor(diff / 1440)} дн назад`
  }

  return (
    <div className="bg-black/40 rounded-xl border border-purple-500/30 p-4">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="text-purple-400 font-bold">📰 КРИПТО-НОВОСТИ</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setFilter('all')} 
            className={`px-3 py-1 rounded-lg text-xs transition ${filter === 'all' ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            Все
          </button>
          <button 
            onClick={() => setFilter('hot')} 
            className={`px-3 py-1 rounded-lg text-xs transition ${filter === 'hot' ? 'bg-orange-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            🔥 Горячие
          </button>
          <button 
            onClick={() => setFilter('bullish')} 
            className={`px-3 py-1 rounded-lg text-xs transition ${filter === 'bullish' ? 'bg-green-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            🟢 Бычьи
          </button>
          <button 
            onClick={() => setFilter('bearish')} 
            className={`px-3 py-1 rounded-lg text-xs transition ${filter === 'bearish' ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            🔴 Медвежьи
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Загрузка новостей...</div>
      ) : news.length === 0 ? (
        <div className="text-center text-gray-500 py-8">Нет новостей</div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {news.map((item, idx) => (
            <div key={idx} className="border-b border-gray-800 pb-3 last:border-0 hover:bg-purple-900/10 transition p-2 rounded-lg">
              <div className="flex gap-2 items-start">
                <span className={`text-xs px-2 py-0.5 rounded-full ${getSentimentColor(item.votes.positive, item.votes.negative)}`}>
                  {item.votes.positive > item.votes.negative ? '📈' : item.votes.negative > item.votes.positive ? '📉' : '⚖️'}
                </span>
                <div className="flex-1">
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-white hover:text-purple-400 transition text-sm"
                  >
                    {item.title}
                  </a>
                  <div className="flex gap-3 mt-1">
                    <span className="text-gray-500 text-xs">{item.source}</span>
                    <span className="text-gray-500 text-xs">{formatTime(item.published_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default News