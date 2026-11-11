// Interactive candlestick chart (TradingView lightweight-charts v4)
import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

const C = {
  text: '#bbcabf',
  grid: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.07)',
  up: '#4edea3',
  down: '#ffb4ab',
  sma20: '#adc6ff',
  sma50: '#ffb95f',
  sma200: '#c4a5ff',
};

const baseOptions = (height) => ({
  height,
  autoSize: true,
  layout: { background: { color: 'transparent' }, textColor: C.text, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
  grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
  rightPriceScale: { borderColor: C.border },
  timeScale: { borderColor: C.border, timeVisible: false },
  crosshair: { mode: CrosshairMode.Normal },
});

const toLine = (candles, values) =>
  candles.map((c, i) => (values[i] == null ? null : { time: c.time, value: values[i] })).filter(Boolean);

export function CandleChart({ candles, overlays = {}, showVolume = true, height = 420, onHover }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, baseOptions(height));

    const candle = chart.addCandlestickSeries({
      upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickUpColor: C.up, wickDownColor: C.down,
    });
    candle.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));

    if (showVolume) {
      const vol = chart.addHistogramSeries({ priceScaleId: '', priceFormat: { type: 'volume' } });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(
        candles.map((c) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(78,222,163,0.35)' : 'rgba(255,180,171,0.35)',
        })),
      );
      candle.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.22 } });
    }

    Object.entries(overlays).forEach(([key, values]) => {
      if (!values) return;
      const s = chart.addLineSeries({ color: C[key] || '#fff', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
      s.setData(toLine(candles, values));
    });

    if (onHover) {
      chart.subscribeCrosshairMove((p) => {
        const d = p.seriesData?.get(candle);
        onHover(d ? { ...d, time: p.time } : null);
      });
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, overlays, showVolume, height]);

  return <div ref={ref} className="chart-box" style={{ height }} />;
}

// Small sub-chart for RSI / MACD
export function IndicatorChart({ candles, lines = [], histogram, height = 140, bands }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      ...baseOptions(height),
      timeScale: { borderColor: C.border, visible: false },
    });
    if (histogram) {
      const h = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
      h.setData(
        candles
          .map((c, i) =>
            histogram[i] == null
              ? null
              : { time: c.time, value: histogram[i], color: histogram[i] >= 0 ? 'rgba(78,222,163,0.55)' : 'rgba(255,180,171,0.55)' },
          )
          .filter(Boolean),
      );
    }
    lines.forEach(({ values, color }, li) => {
      const s = chart.addLineSeries({ color, lineWidth: 1.5, priceLineVisible: false });
      s.setData(toLine(candles, values));
      if (li === 0) bands?.forEach((b) =>
        s.createPriceLine({ price: b.value, color: b.color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: b.label }),
      );
    });
    chart.timeScale().fitContent();
    return () => chart.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, lines, histogram, height]);

  return <div ref={ref} className="chart-box" style={{ height }} />;
}
