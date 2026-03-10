import { useRef, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ModelViewer } from '../components/ModelViewer';
import { CelestialSphere } from '../components/CelestialSphere';
import { useMLWebSocket, type SerialReading } from '../hooks/useMLWebSocket';
import './Dashboard.css';

interface DataRow {
    [key: string]: string | number;
}

interface Metrics {
    current: number | string;
    voltage: number | string;
    power: number | string;
    theft: boolean;
}

function parseMetrics(rows: DataRow[]): Metrics {
    if (!rows.length) return { current: '—', voltage: '—', power: '—', theft: false };
    const latest = rows[rows.length - 1];

    const find = (keys: string[]) => {
        for (const k of Object.keys(latest)) {
            if (keys.some(q => k.toLowerCase().includes(q))) {
                const v = parseFloat(String(latest[k]));
                return isNaN(v) ? latest[k] : v;
            }
        }
        return '—';
    };

    const status = String(find(['status', 'alert', 'theft'])).toLowerCase();
    const theft = status.includes('theft') || status.includes('alert') || status === '1' || status === 'true';

    return {
        current: find(['current', 'i(a)', 'amps', 'amp']),
        voltage: find(['voltage', 'v(v)', 'volts', 'volt']),
        power: find(['power', 'w(w)', 'watt']),
        theft,
    };
}

/* ── Mini sparkline component ─────────────────────── */
function Sparkline({ data, color, height = 60 }: { data: number[]; color: string; height?: number }) {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 200;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox={`0 0 ${w} ${height}`} className="sparkline-svg" preserveAspectRatio="none">
            <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
        </svg>
    );
}

export function Dashboard() {
    /* ── File-upload state ─────────────────── */
    const [rows, setRows] = useState<DataRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({ current: '—', voltage: '—', power: '—', theft: false });
    const [fileName, setFileName] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    /* ── ML WebSocket state (serial + ML from Python server) ── */
    const {
        connected, readings, latest, error, connect, disconnect,
        phase, baseline, theftDetected, theftEvents, trainingProgress, retrain,
    } = useMLWebSocket();
    const [mode, setMode] = useState<'file' | 'serial'>('serial');



    const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setMode('file');

        const reader = new FileReader();
        reader.onload = (ev) => {
            const wb = XLSX.read(ev.target?.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json<DataRow>(ws, { defval: '' });
            const hdrs = data.length ? Object.keys(data[0]) : [];
            setRows(data);
            setHeaders(hdrs);
            setMetrics(parseMetrics(data));
        };
        reader.readAsArrayBuffer(file);
    }, []);

    /* ── Derive metrics from serial or file ── */
    const liveMetrics: Metrics = latest
        ? {
            voltage: latest.bus_V,
            current: latest.current_mA,
            power: latest.power_mW,
            theft: theftDetected,
        }
        : { voltage: '—', current: '—', power: '—', theft: false };

    const activeMetrics = mode === 'serial' && connected ? liveMetrics : metrics;

    /* ── Sparkline data (last 50 readings) ── */
    const last50 = readings.slice(-50);
    const voltageHistory = last50.map(r => r.bus_V);
    const currentHistory = last50.map(r => r.current_mA);
    const powerHistory = last50.map(r => r.power_mW);

    const metricCards = [
        {
            label: 'Voltage',
            value: typeof activeMetrics.voltage === 'number' ? `${activeMetrics.voltage.toFixed(3)} V` : activeMetrics.voltage,
            icon: '🔋',
            color: 'card-teal',
            sparkData: voltageHistory,
            sparkColor: '#14b8a6',
        },
        {
            label: 'Current',
            value: typeof activeMetrics.current === 'number' ? `${activeMetrics.current.toFixed(2)} mA` : activeMetrics.current,
            icon: '⚡',
            color: 'card-green',
            sparkData: currentHistory,
            sparkColor: '#4ade80',
        },
        {
            label: 'Power',
            value: typeof activeMetrics.power === 'number' ? `${activeMetrics.power.toFixed(2)} mW` : activeMetrics.power,
            icon: '💡',
            color: 'card-lime',
            sparkData: powerHistory,
            sparkColor: '#a3e635',
        },
        {
            label: 'Theft Alert',
            value: activeMetrics.theft ? 'DETECTED' : 'Secure',
            icon: activeMetrics.theft ? '🚨' : '🛡️',
            color: activeMetrics.theft ? 'card-alert' : 'card-safe',
            sparkData: [] as number[],
            sparkColor: '',
        },
    ];

    /* ── Format timestamp for table ── */
    const fmtTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions);
    };

    return (
        <div className="dash-root">
            <CelestialSphere hue={140} speed={0.2} zoom={1.2} particleSize={3} />

            <div className="dash-content-wrapper">
                {/* Top bar */}
                <header className="dash-header">
                    <div className="dash-brand">
                        <span className="glow-icon">⚡</span> DC TheftProtector Live Monitoring
                    </div>

                    <div className="dash-header-actions">
                        {/* Serial connect/disconnect */}
                        <button
                            className={`serial-btn ${connected ? 'serial-btn-connected' : ''}`}
                            onClick={() => {
                                if (connected) { disconnect(); }
                                else { setMode('serial'); connect(); }
                            }}
                        >
                            <span className={`serial-dot ${connected ? 'dot-live' : ''}`} />
                            {connected ? 'Disconnect' : 'Connect Serial'}
                        </button>

                        <label className="dash-upload-btn">
                            {fileName || 'Upload Excel / CSV'}
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                style={{ display: 'none' }}
                                onChange={handleFile}
                            />
                        </label>
                    </div>
                </header>

                {error && <div className="serial-error">Serial Error: {error}</div>}

                {/* Theft alert banner */}
                {theftDetected && phase === 'monitoring' && (
                    <div className="theft-banner">
                        <span className="theft-banner-icon">🚨</span>
                        <span>THEFT DETECTED — Abnormal current deviation from baseline!</span>
                    </div>
                )}

                {/* Two-column layout */}
                <div className="dash-body">
                    {/* LEFT — sticky 3D viewer */}
                    <aside className="dash-left">
                        <div className="model-card glass-panel">
                            <div className="model-label">ESP32-C6 Module</div>
                            <div className="model-canvas">
                                <ModelViewer url="/models/ESP32C6.glb" />
                            </div>
                            <p className="model-hint">Drag to rotate</p>
                        </div>
                    </aside>

                    {/* RIGHT — metrics + live table */}
                    <main className="dash-right">
                        {/* ML Status Panel */}
                        {mode === 'serial' && connected && (
                            <div className={`ml-status glass-panel ${phase === 'training' ? 'ml-training' : phase === 'monitoring' ? (theftDetected ? 'ml-alert' : 'ml-safe') : ''}`}>
                                <div className="ml-status-header">
                                    <span className="ml-status-icon">
                                        {phase === 'training' ? '🧠' : phase === 'monitoring' ? (theftDetected ? '🚨' : '🛡️') : '⏳'}
                                    </span>
                                    <div className="ml-status-text">
                                        <span className="ml-status-title">
                                            {phase === 'idle' && 'Waiting for data...'}
                                            {phase === 'training' && `Training baseline model... ${trainingProgress}%`}
                                            {phase === 'monitoring' && !theftDetected && 'Monitoring — System Secure'}
                                            {phase === 'monitoring' && theftDetected && 'ANOMALY DETECTED — Possible Theft!'}
                                        </span>
                                        <span className="ml-status-sub">
                                            {phase === 'training' && `Collecting normal operating data (${trainingProgress}% of 60s)`}
                                            {phase === 'monitoring' && baseline && (
                                                `Baseline: ${baseline.meanCurrent.toFixed(2)} ± ${baseline.stdCurrent.toFixed(2)} mA  |  ${baseline.sampleCount} samples  |  ${theftEvents.length} alerts`
                                            )}
                                        </span>
                                    </div>
                                    {phase === 'monitoring' && (
                                        <button className="ml-retrain-btn" onClick={retrain}>Retrain</button>
                                    )}
                                </div>
                                {phase === 'training' && (
                                    <div className="ml-progress-bar">
                                        <div className="ml-progress-fill" style={{ width: `${trainingProgress}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Metric cards */}
                        <div className="metrics-grid">
                            {metricCards.map(c => (
                                <div className={`metric-card glass-panel ${c.color}`} key={c.label}>
                                    <span className="metric-icon">{c.icon}</span>
                                    <div className="metric-info">
                                        <span className="metric-value">{c.value}</span>
                                        <span className="metric-label">{c.label}</span>
                                        {c.sparkData.length > 1 && (
                                            <Sparkline data={c.sparkData} color={c.sparkColor} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Theft event log */}
                        {theftEvents.length > 0 && (
                            <div className="data-table-wrap glass-panel theft-log-panel">
                                <div className="table-header-row">
                                    <h3 className="table-title theft-log-title">
                                        🚨 Theft Event Log
                                    </h3>
                                    <span className="row-count alert-count">{theftEvents.length} alerts</span>
                                </div>
                                <div className="table-scroll" style={{ maxHeight: '200px' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Time</th>
                                                <th>Type</th>
                                                <th>Current (mA)</th>
                                                <th>Deviation (σ)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...theftEvents].reverse().slice(0, 50).map((evt, i) => (
                                                <tr key={evt.timestamp + '-' + i} className="theft-event-row">
                                                    <td>{fmtTime(evt.timestamp)}</td>
                                                    <td>{evt.type.replace('_', ' ')}</td>
                                                    <td>{evt.reading.current_mA.toFixed(2)}</td>
                                                    <td>{evt.deviation.toFixed(1)}σ</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* SERIAL live table */}
                        {mode === 'serial' && connected && readings.length > 0 && (
                            <div className="data-table-wrap glass-panel">
                                <div className="table-header-row">
                                    <h3 className="table-title">
                                        <span className="live-dot" /> Live Serial Data
                                    </h3>
                                    <span className="row-count">{readings.length} readings</span>
                                </div>
                                <div className="table-scroll">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Time</th>
                                                <th>Bus (V)</th>
                                                <th>Current (mA)</th>
                                                <th>Power (mW)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...readings].reverse().slice(0, 100).map((r: SerialReading, i: number) => (
                                                <tr key={r.timestamp + '-' + i} className={i === 0 ? 'latest-row' : ''}>
                                                    <td>{fmtTime(r.timestamp)}</td>
                                                    <td>{r.bus_V.toFixed(3)}</td>
                                                    <td>{r.current_mA.toFixed(2)}</td>
                                                    <td>{r.power_mW.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* SERIAL waiting state */}
                        {mode === 'serial' && connected && readings.length === 0 && (
                            <div className="empty-state glass-panel">
                                <div className="empty-icon">📡</div>
                                <p>Waiting for data from ESP32...</p>
                                <div className="pulse-ring" />
                            </div>
                        )}

                        {/* FILE data table */}
                        {mode === 'file' && rows.length > 0 && (
                            <div className="data-table-wrap glass-panel">
                                <div className="table-header-row">
                                    <h3 className="table-title">📊 Data — {fileName}</h3>
                                    <span className="row-count">{rows.length} rows</span>
                                </div>
                                <div className="table-scroll">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                {headers.map(h => <th key={h}>{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...rows].reverse().map((row, i) => (
                                                <tr key={i} className={i === 0 ? 'latest-row' : ''}>
                                                    {headers.map(h => <td key={h}>{String(row[h])}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Initial empty state */}
                        {!connected && rows.length === 0 && (
                            <div className="empty-state glass-panel">
                                <div className="empty-icon">📂</div>
                                <p>Connect via Serial or upload a file to see live data</p>
                                <div className="empty-actions">
                                    <button className="serial-btn" onClick={() => { setMode('serial'); connect(); }}>
                                        <span className="serial-dot" /> Connect Serial
                                    </button>
                                    <label className="btn-upload-cta">
                                        Upload File
                                        <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} />
                                    </label>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
