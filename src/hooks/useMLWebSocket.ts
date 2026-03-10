import { useState, useRef, useCallback, useEffect } from 'react';

export interface SerialReading {
  bus_V: number;
  current_mA: number;
  power_mW: number;
  timestamp: number;
}

export interface BaselineModel {
  meanCurrent: number;
  stdCurrent: number;
  meanVoltage: number;
  stdVoltage: number;
  meanPower: number;
  stdPower: number;
  sampleCount: number;
  trainedAt: number;
}

export interface TheftEvent {
  timestamp: number;
  reading: SerialReading;
  deviation: number;
  type: 'current_drop' | 'current_spike' | 'voltage_drop';
}

export type DetectionPhase = 'idle' | 'training' | 'monitoring';

const WS_URL = 'ws://localhost:8765';
const MAX_READINGS = 500;

export function useMLWebSocket() {
  const [connected, setConnected] = useState(false);
  const [readings, setReadings] = useState<SerialReading[]>([]);
  const [latest, setLatest] = useState<SerialReading | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ML state
  const [phase, setPhase] = useState<DetectionPhase>('idle');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [baseline, setBaseline] = useState<BaselineModel | null>(null);
  const [theftDetected, setTheftDetected] = useState(false);
  const [theftEvents, setTheftEvents] = useState<TheftEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'reading' && msg.data) {
        const r: SerialReading = msg.data;
        setLatest(r);
        setReadings(prev => {
          const next = [...prev, r];
          return next.length > MAX_READINGS ? next.slice(-MAX_READINGS) : next;
        });
      }

      if (msg.type === 'ml_status' && msg.data) {
        const s = msg.data;
        setPhase(s.phase ?? 'idle');
        setTrainingProgress(s.trainingProgress ?? 0);
        setBaseline(s.baseline ?? null);
        setTheftDetected(s.theftDetected ?? false);
        setTheftEvents(s.theftEvents ?? []);
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setError(null);

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnected(true);
        setReadings([]);
        setLatest(null);
        setError(null);
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setError('WebSocket connection error — is the Python ML server running?');
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to ML server';
      setError(msg);
    }
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setPhase('idle');
    setTrainingProgress(0);
    setBaseline(null);
    setTheftDetected(false);
    setTheftEvents([]);
  }, []);

  const retrain = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'retrain' }));
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, []);

  return {
    // Serial-like interface
    connected,
    readings,
    latest,
    error,
    connect,
    disconnect,
    // ML interface
    phase,
    trainingProgress,
    baseline,
    theftDetected,
    theftEvents,
    retrain,
  };
}
