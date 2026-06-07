async closeByReverseSignal(symbol: string, signalSide: string): Promise<boolean> {
  // Проверяем, есть ли позиция
  const positionIndex = this.positions.findIndex(p => p.symbol === symbol)
  if (positionIndex === -1) return false  // ← если позиции нет, просто выходим
  
  const position = this.positions[positionIndex]
  
  // Проверяем, противоположный ли сигнал
  if ((position.side === 'Buy' && signalSide === 'Sell') ||
      (position.side === 'Sell' && signalSide === 'Buy')) {
    const currentPrice = parseFloat(localStorage.getItem(`price_${symbol}`) || position.entryPrice.toString())
    await this.closePosition(symbol, currentPrice, 'Reverse signal')
    return true
  }
  return false
}
