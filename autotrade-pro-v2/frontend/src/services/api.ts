private async fetchPrices() {
    try {
      let allTickers: any[] = [];
      let cursor = '';
      let pageCount = 0;
      const maxPages = 5; // Максимум 5 страниц = 500 тикеров

      while (pageCount < maxPages) {
        const url = `https://api.bybit.com/v5/market/tickers?category=spot&limit=100${cursor ? '&cursor=' + cursor : ''}`;
        const res = await fetch(url);
        if (!res.ok) break;
        const data = await res.json();
        
        if (data.retCode !== 0 || !data.result?.list || data.result.list.length === 0) break;
        
        allTickers = [...allTickers, ...data.result.list];
        const nextCursor = data.result.nextPageCursor || '';
        
        // Если курсор не изменился — выходим
        if (!nextCursor || nextCursor === cursor) break;
        
        cursor = nextCursor;
        pageCount++;
      }

      // Обрабатываем тикеры
      for (const ticker of allTickers) {
        const symbol = this.symbols.find(s => s.replace('/', '') === ticker.symbol);
        if (!symbol) continue;

        const priceData: PriceData = {
          symbol,
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.price24hPcnt) * 100,
          volume24h: parseFloat(ticker.volume24h),
          high24h: parseFloat(ticker.highPrice24h),
          low24h: parseFloat(ticker.lowPrice24h),
          timestamp: Date.now()
        };

        this.subscribers.get(symbol)?.forEach(cb => cb(priceData));
      }
    } catch (error) {
      console.warn('⚠️ Ошибка запроса цен Bybit');
    }
  }
