import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── 1. Scene, Camera, Renderer ──────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060b18, 0.025);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // ── 2. Lights ────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0a2540, 1.5);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x06d6a0, 3, 50);
    pointLight1.position.set(10, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x4cc9f0, 2.5, 50);
    pointLight2.position.set(-10, -10, 8);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x7b61ff, 2, 40);
    pointLight3.position.set(0, 15, -5);
    scene.add(pointLight3);

    // ── 3. 3D Holographic Core (Wireframe Icosahedron & Inner Core) ─────
    const coreGroup = new THREE.Group();
    coreGroup.position.set(7, 0, 0); // Position to right/center
    scene.add(coreGroup);

    // Outer wireframe icosahedron
    const icoGeo = new THREE.IcosahedronGeometry(5, 1);
    const icoMat = new THREE.MeshStandardMaterial({
      color: 0x06d6a0,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
      metalness: 0.8
    });
    const icoMesh = new THREE.Mesh(icoGeo, icoMat);
    coreGroup.add(icoMesh);

    // Inner glowing sphere
    const sphereGeo = new THREE.SphereGeometry(2.6, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0x4cc9f0,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.9
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    coreGroup.add(sphereMesh);

    // Outer orbiting rings
    const ringGeo1 = new THREE.TorusGeometry(6.5, 0.04, 16, 100);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x06d6a0, transparent: true, opacity: 0.4 });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    coreGroup.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(7.2, 0.04, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x7b61ff, transparent: true, opacity: 0.35 });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 4;
    coreGroup.add(ring2);

    // ── 4. 3D Floating DNA Double Helix ──────────────────────────────────
    const dnaGroup = new THREE.Group();
    dnaGroup.position.set(-10, -2, -4);
    dnaGroup.rotation.z = Math.PI / 6;
    scene.add(dnaGroup);

    const dnaCount = 40;
    const dnaRadius = 2.0;
    const dnaHeight = 22;
    const sphereNodeGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const nodeMatCyan = new THREE.MeshStandardMaterial({ color: 0x06d6a0, roughness: 0.3, metalness: 0.8 });
    const nodeMatBlue = new THREE.MeshStandardMaterial({ color: 0x4cc9f0, roughness: 0.3, metalness: 0.8 });
    const rungLineMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.4 });

    for (let i = 0; i < dnaCount; i++) {
      const t = (i / dnaCount) * Math.PI * 4;
      const y = (i / dnaCount) * dnaHeight - dnaHeight / 2;

      const x1 = Math.cos(t) * dnaRadius;
      const z1 = Math.sin(t) * dnaRadius;
      const node1 = new THREE.Mesh(sphereNodeGeo, nodeMatCyan);
      node1.position.set(x1, y, z1);
      dnaGroup.add(node1);

      const x2 = Math.cos(t + Math.PI) * dnaRadius;
      const z2 = Math.sin(t + Math.PI) * dnaRadius;
      const node2 = new THREE.Mesh(sphereNodeGeo, nodeMatBlue);
      node2.position.set(x2, y, z2);
      dnaGroup.add(node2);

      // Connecting rung
      const points = [new THREE.Vector3(x1, y, z1), new THREE.Vector3(x2, y, z2)];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, rungLineMat);
      dnaGroup.add(line);
    }

    // ── 5. Starfield / Telemetry Particle Field ──────────────────────────
    const particleCount = 700;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const c1 = new THREE.Color(0x06d6a0);
    const c2 = new THREE.Color(0x4cc9f0);
    const c3 = new THREE.Color(0x7b61ff);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 80;
      positions[i + 1] = (Math.random() - 0.5) * 60;
      positions[i + 2] = (Math.random() - 0.5) * 50;

      const chosenColor = Math.random() > 0.6 ? c1 : (Math.random() > 0.5 ? c2 : c3);
      colors[i] = chosenColor.r;
      colors[i + 1] = chosenColor.g;
      colors[i + 2] = chosenColor.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.65
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // ── 6. Mouse Interaction & Responsive Handling ──────────────────────
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (event) => {
      mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // ── 7. Animation Loop ───────────────────────────────────────────────
    let frameId;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse lerp
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      // Rotate holographic core
      icoMesh.rotation.x = elapsedTime * 0.15;
      icoMesh.rotation.y = elapsedTime * 0.2;
      sphereMesh.rotation.y = -elapsedTime * 0.3;
      ring1.rotation.z = elapsedTime * 0.1;
      ring2.rotation.z = -elapsedTime * 0.12;

      // Subtle breath pulsing on core
      const scale = 1 + Math.sin(elapsedTime * 2) * 0.04;
      coreGroup.scale.set(scale, scale, scale);

      // Rotate DNA double helix
      dnaGroup.rotation.y = elapsedTime * 0.25;

      // Parallax effect on entire scene via camera tilt
      camera.position.x = targetX * 3;
      camera.position.y = -targetY * 2;
      camera.lookAt(scene.position);

      // Slow drift on particle system
      particleSystem.rotation.y = elapsedTime * 0.02;

      renderer.render(scene, camera);
    };

    animate();

    // ── 8. Cleanup on Unmount ───────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      icoGeo.dispose();
      icoMat.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      sphereNodeGeo.dispose();
      nodeMatCyan.dispose();
      nodeMatBlue.dispose();
      rungLineMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    />
  );
}
