// Звуковые оповещения и голос

class SoundService {
  private audioContext: AudioContext | null = null
  private lastSignalTime: number = 0
  private minInterval: number = 5000 // Минимум 5 секунд между сигналами

  playBeep() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      
      const now = Date.now()
      if (now - this.lastSignalTime < this.minInterval) return
      this.lastSignalTime = now
      
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      oscillator.frequency.value = 880
      gainNode.gain.value = 0.3
      
      oscillator.start()
      gainNode.gain.exponentialRampToValueAtTime(0.00001, this.audioContext.currentTime + 0.5)
      oscillator.stop(this.audioContext.currentTime + 0.5)
      
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume()
      }
    } catch (e) {
      console.log('Sound error:', e)
    }
  }

  speak(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ru-RU'
      utterance.rate = 1.0
      utterance.volume = 0.8
      window.speechSynthesis.speak(utterance)
    }
  }

  notifyNewSignal(signal: { action: string; symbol: string; strength: number }) {
    this.playBeep()
    
    let message = signal.action === 'buy' 
      ? `Новый бычий сигнал по ${signal.symbol}`
      : `Новый медвежий сигнал по ${signal.symbol}`
    
    if (signal.strength >= 4) {
      message += `. Сильный сигнал!`
    }
    
    this.speak(message)
  }
}

export const soundService = new SoundService()