import { useRef, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ModelViewer } from '../components/ModelViewer';
import { CelestialSphere } from '../components/CelestialSphere';
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

export function Dashboard() {
    const [rows, setRows] = useState<DataRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({ current: '—', voltage: '—', power: '—', theft: false });
    const [fileName, setFileName] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);

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

    const metricCards = [
        {
            label: 'Current',
            value: typeof metrics.current === 'number' ? `${metrics.current.toFixed(2)} A` : metrics.current,
            icon: '⚡',
            color: 'card-green',
        },
        {
            label: 'Voltage',
            value: typeof metrics.voltage === 'number' ? `${metrics.voltage.toFixed(2)} V` : metrics.voltage,
            icon: '🔋',
            color: 'card-teal',
        },
        {
            label: 'Power',
            value: typeof metrics.power === 'number' ? `${metrics.power.toFixed(2)} W` : metrics.power,
            icon: '💡',
            color: 'card-lime',
        },
        {
            label: 'Theft Alert',
            value: metrics.theft ? 'DETECTED' : 'Secure',
            icon: metrics.theft ? '🚨' : '🛡️',
            color: metrics.theft ? 'card-alert' : 'card-safe',
        },
    ];

    return (
        <div className="dash-root">
            {/* Background Shader */}
            <CelestialSphere hue={140} speed={0.2} zoom={1.2} particleSize={3} />

            <div className="dash-content-wrapper">
                {/* Top bar */}
                <header className="dash-header">
                    <div className="dash-brand">
                        <span className="glow-icon">⚡</span> DC TheftProtector Live Monitoring
                    </div>
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
                </header>

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

                    {/* RIGHT — scrollable metrics + table */}
                    <main className="dash-right">
                        {/* Metric cards */}
                        <div className="metrics-grid">
                            {metricCards.map(c => (
                                <div className={`metric-card glass-panel ${c.color}`} key={c.label}>
                                    <span className="metric-icon">{c.icon}</span>
                                    <div className="metric-info">
                                        <span className="metric-value">{c.value}</span>
                                        <span className="metric-label">{c.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Data table */}
                        {rows.length > 0 ? (
                            <div className="data-table-wrap glass-panel">
                                <div className="table-header-row">
                                    <h3 className="table-title">📊 Live Data — {fileName}</h3>
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
                                            {rows.map((row, i) => (
                                                <tr key={i} className={i === rows.length - 1 ? 'latest-row' : ''}>
                                                    {headers.map(h => <td key={h}>{String(row[h])}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state glass-panel">
                                <div className="empty-icon">📂</div>
                                <p>Upload an Excel or CSV file to see live data</p>
                                <label className="btn-upload-cta">
                                    Choose File
                                    <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} />
                                </label>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
