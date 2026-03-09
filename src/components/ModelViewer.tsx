import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface ModelViewerProps {
    url: string;
}

export function ModelViewer({ url }: ModelViewerProps) {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;
        const mount = mountRef.current;
        let animationId: number;

        // ── Scene ──────────────────────────────────────────────────────────
        const scene = new THREE.Scene();

        const w = mount.clientWidth;
        const h = mount.clientHeight;

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(0, 0, 100);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(w, h);
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);

        // ── Lights ─────────────────────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0xffffff, 1.2));

        const dir = new THREE.DirectionalLight(0xffffff, 1.5);
        dir.position.set(5, 10, 7);
        scene.add(dir);

        const dir2 = new THREE.DirectionalLight(0x4ade80, 0.5); // Subtle green fill
        dir2.position.set(-5, -5, -3);
        scene.add(dir2);

        // Group to hold the loaded model for rotation
        const group = new THREE.Group();
        scene.add(group);

        // ── Load GLB ───────────────────────────────────────────────────────
        const loader = new GLTFLoader();
        loader.load(
            url,
            (gltf) => {
                const model = gltf.scene;

                // Auto-center and scale
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                const maxDim = Math.max(size.x, size.y, size.z);
                // Scale it so it fits nicely in our view (adjust multiplier if needed)
                const scale = 50 / maxDim;

                model.position.sub(center); // Center the model's geometry
                group.add(model);
                group.scale.setScalar(scale);

                // Adjust camera to look at the scaled model
                camera.position.set(0, 20, 80);
                camera.lookAt(0, 0, 0);
            },
            undefined,
            (error) => {
                console.error('Error loading GLB:', error);
            }
        );

        // ── Mouse rotate ────────────────────────────────────────────────────
        let isDragging = false;
        let prevX = 0;
        let prevY = 0;

        const onMouseDown = (e: MouseEvent) => { isDragging = true; prevX = e.clientX; prevY = e.clientY; };
        const onMouseUp = () => { isDragging = false; };
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            group.rotation.y += (e.clientX - prevX) * 0.01;
            group.rotation.x += (e.clientY - prevY) * 0.01;
            prevX = e.clientX;
            prevY = e.clientY;
        };

        mount.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('mousemove', onMouseMove);

        // ── Auto-rotate ─────────────────────────────────────────────────────
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            if (!isDragging) group.rotation.y += 0.005; // Slow spin
            renderer.render(scene, camera);
        };
        animate();

        // ── Resize ──────────────────────────────────────────────────────────
        const handleResize = () => {
            const w2 = mount.clientWidth;
            const h2 = mount.clientHeight;
            camera.aspect = w2 / h2;
            camera.updateProjectionMatrix();
            renderer.setSize(w2, h2);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationId);
            mount.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('resize', handleResize);

            renderer.dispose();
            if (mount.contains(renderer.domElement)) {
                mount.removeChild(renderer.domElement);
            }
        };
    }, [url]);

    return (
        <div
            ref={mountRef}
            style={{ width: '100%', height: '100%', cursor: 'grab' }}
        />
    );
}
