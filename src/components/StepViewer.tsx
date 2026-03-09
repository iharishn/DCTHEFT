import { useEffect, useRef } from 'react';

// online-3d-viewer is loaded as a global via CDN script in index.html
declare const OV: any;

interface StepViewerProps {
    url: string;
}

export function StepViewer({ url }: StepViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Give each instance a stable unique ID
    const viewerIdRef = useRef(`ov-viewer-${Math.random().toString(36).slice(2, 9)}`);

    useEffect(() => {
        if (!containerRef.current) return;
        if (typeof OV === 'undefined') {
            console.warn('online-3d-viewer not loaded yet');
            return;
        }

        const el = containerRef.current;
        el.id = viewerIdRef.current;

        // Clear any previous content
        el.innerHTML = '';

        OV.Init3DViewerFromFileList(
            viewerIdRef.current,
            [{ name: 'ESP32C6.step', url }],
            {
                // Transparent background so our dark CSS shows through
                backgroundColor: new OV.RGBAColor(4, 10, 6, 0),
                // Subtle default edge highlight
                edgeSettings: new OV.EdgeSettings(true, new OV.RGBColor(34, 197, 94), 1),
            }
        );
    }, [url]);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%' }}
        />
    );
}
