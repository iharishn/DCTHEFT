import { useState, useRef, useCallback } from 'react';

export interface SerialReading {
  bus_V: number;
  current_mA: number;
  power_mW: number;
  timestamp: number;
}

export function useSerial(baudRate = 115200) {
  const [connected, setConnected] = useState(false);
  const [readings, setReadings] = useState<SerialReading[]>([]);
  const [latest, setLatest] = useState<SerialReading | null>(null);
  const [error, setError] = useState<string | null>(null);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef('');

  const parseLine = useCallback((line: string): SerialReading | null => {
    // Parse: "Bus: 9.404 V  Current: 36.10 mA  Power: 339.48 mW"
    const busMatch = line.match(/Bus:\s*([\d.]+)\s*V/i);
    const currMatch = line.match(/Current:\s*([\d.]+)\s*mA/i);
    const powMatch = line.match(/Power:\s*([\d.]+)\s*mW/i);

    if (busMatch && currMatch && powMatch) {
      return {
        bus_V: parseFloat(busMatch[1]),
        current_mA: parseFloat(currMatch[1]),
        power_mW: parseFloat(powMatch[1]),
        timestamp: Date.now(),
      };
    }
    return null;
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);

      // If a previous port is still held, close it first
      if (portRef.current) {
        try {
          abortRef.current?.abort();
          abortRef.current = null;
          try { await readerRef.current?.cancel(); } catch { /* */ }
          readerRef.current = null;
          await portRef.current.close();
        } catch { /* */ }
        portRef.current = null;
      }

      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;

      const decoder = new TextDecoderStream();
      abortRef.current = new AbortController();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (port.readable as any).pipeTo(decoder.writable, { signal: abortRef.current.signal }).catch(() => {});
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      setConnected(true);
      setReadings([]);

      // Read loop
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;

            bufferRef.current += value;
            const lines = bufferRef.current.split('\n');
            bufferRef.current = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const reading = parseLine(trimmed);
              if (reading) {
                setLatest(reading);
                setReadings(prev => {
                  const next = [...prev, reading];
                  return next.length > 500 ? next.slice(-500) : next;
                });
              }
            }
          }
        } catch {
          // stream closed
        } finally {
          setConnected(false);
        }
      })();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      setError(msg);
      setConnected(false);
    }
  }, [baudRate, parseLine]);

  const disconnect = useCallback(async () => {
    try {
      // 1. Abort the pipe stream
      abortRef.current?.abort();
      abortRef.current = null;

      // 2. Cancel the reader and wait for it to release
      if (readerRef.current) {
        try { await readerRef.current.cancel(); } catch { /* */ }
        readerRef.current = null;
      }

      // 3. Small delay to let streams fully release
      await new Promise(r => setTimeout(r, 100));

      // 4. Close the port
      if (portRef.current) {
        try { await portRef.current.close(); } catch { /* */ }
        portRef.current = null;
      }
    } catch {
      // ignore cleanup errors
    }
    setConnected(false);
    bufferRef.current = '';
  }, []);

  return { connected, readings, latest, error, connect, disconnect };
}
