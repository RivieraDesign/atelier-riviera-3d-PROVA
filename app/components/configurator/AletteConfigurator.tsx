"use client";
/* eslint-disable @next/next/no-img-element -- Le texture locali devono restare immagini dirette per il configuratore WebGL. */

import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  atelierProducts,
  stoneMaterials,
  type AlettePartId,
  type AtelierProductId,
  type ProductPart,
  type StoneMaterial,
} from "../../data/atelier-catalog";
type ViewName = "perspective" | "front" | "side" | "top";
type LoadStatus = "loading" | "ready" | "error";
type PartMaterials = Record<AlettePartId, string>;
type EnvironmentStatus = "idle" | "loading" | "ready" | "error";

type EnvironmentPlacement = {
  x: number;
  y: number;
  scale: number;
  shadow: number;
};

type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

type CameraTransition = CameraPose & {
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  startedAt: number;
  duration: number;
};

type ViewerActions = {
  applyMaterial: (partId: AlettePartId, materialId: string) => Promise<void>;
  updateTextureScale: (scale: number) => void;
  setExposure: (value: number) => void;
  setExploded: (value: boolean) => void;
  setAutoRotate: (value: boolean) => void;
  setView: (view: ViewName) => void;
  setEnvironmentEnabled: (value: boolean) => void;
  updateEnvironmentPlacement: (placement: EnvironmentPlacement) => void;
  saveImage: () => void;
};

const initialEnvironmentPlacement: EnvironmentPlacement = {
  x: 0,
  y: 0,
  scale: 1,
  shadow: 0.22,
};

const environmentFileTypes = ["image/jpeg", "image/png", "image/webp"];
const environmentFileMaxBytes = 20 * 1024 * 1024;
const environmentImageMaxPixels = 40_000_000;

const initialMaterials: PartMaterials = {
  top: "bianco-carrara",
  "leg-a": "bianco-carrara",
  "leg-b": "bianco-carrara",
};

const partTextureOffsets: Record<AlettePartId, readonly [number, number]> = {
  top: [0.03, 0.06],
  "leg-a": [0.17, 0.11],
  "leg-b": [0.31, 0.23],
};

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    const mapped = item as THREE.MeshStandardMaterial;
    mapped.map?.dispose();
    item.dispose();
  }
}

function prepareGeometry(mesh: THREE.Mesh, part: ProductPart) {
  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);

    if (part.id === "top") {
      uv[index * 2] = x + 0.5;
      uv[index * 2 + 1] = z + 0.5;
    } else if (part.id === "leg-a") {
      uv[index * 2] = x + 0.5;
      uv[index * 2 + 1] = y;
    } else {
      uv[index * 2] = z + 0.5;
      uv[index * 2 + 1] = y;
    }
  }

  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  mesh.geometry = geometry;
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

export default function AletteConfigurator() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<ViewerActions | null>(null);
  const materialsRef = useRef<PartMaterials>(initialMaterials);
  const textureScaleRef = useRef(1);
  const partButtons = useRef<Partial<Record<AlettePartId, HTMLButtonElement | null>>>({});
  const environmentInputRef = useRef<HTMLInputElement>(null);
  const environmentImageRef = useRef<HTMLImageElement>(null);
  const environmentUrlRef = useRef<string | null>(null);
  const environmentPendingUrlRef = useRef<string | null>(null);
  const environmentLoadRequestRef = useRef(0);
  const environmentPlacementRef = useRef<EnvironmentPlacement>(initialEnvironmentPlacement);
const [selectedProductId, setSelectedProductId] =
  useState<AtelierProductId>("riviera-coffee");

const selectedProduct = atelierProducts[selectedProductId];
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [selectedPart, setSelectedPart] = useState<AlettePartId>("top");
  const [partMaterials, setPartMaterials] = useState<PartMaterials>(initialMaterials);
  const [textureScale, setTextureScale] = useState(1);
  const [exposure, setExposure] = useState(1);
  const [exploded, setExploded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>("perspective");
  const [environmentUrl, setEnvironmentUrl] = useState<string | null>(null);
  const [environmentStatus, setEnvironmentStatus] = useState<EnvironmentStatus>("idle");
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [environmentPlacement, setEnvironmentPlacement] = useState<EnvironmentPlacement>(
    initialEnvironmentPlacement,
  );
  const [exportMessage, setExportMessage] = useState("");

  const selectedPartDefinition = useMemo(
    () => aletteCoffee.parts.find((part) => part.id === selectedPart) ?? aletteCoffee.parts[0],
    [selectedPart],
  );
  const selectedMaterial = useMemo(
    () => stoneMaterials.find((material) => material.id === partMaterials[selectedPart]) ?? stoneMaterials[0],
    [partMaterials, selectedPart],
  );
  const canApplyEverywhere = selectedMaterial.allowedOn.includes("leg");

  useEffect(() => {
    materialsRef.current = partMaterials;
  }, [partMaterials]);

  useEffect(() => {
    textureScaleRef.current = textureScale;
  }, [textureScale]);

  useEffect(() => () => {
    environmentLoadRequestRef.current += 1;
    if (environmentPendingUrlRef.current) URL.revokeObjectURL(environmentPendingUrlRef.current);
    if (environmentUrlRef.current) URL.revokeObjectURL(environmentUrlRef.current);
    environmentPendingUrlRef.current = null;
    environmentUrlRef.current = null;
  }, [selectedProduct]);

  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;
    const viewerContainer: HTMLDivElement = container;

    let disposed = false;
    let animationFrame = 0;
    const meshes = new Map<AlettePartId, THREE.Mesh>();
    const texturePromises = new Map<string, Promise<THREE.Texture>>();
    const materialRequest = new Map<AlettePartId, number>();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const explodeTimers = new Set<number>();
    const downloadUrls = new Set<string>();
    const feedbackTimers = new Set<number>();
    let explodedViewActive = false;
    let environmentEnabled = false;
    let currentEnvironmentPlacement = initialEnvironmentPlacement;
    let activeCameraView: ViewName = "perspective";
    let cameraBeforeExplode: CameraPose | null = null;
    let cameraTransition: CameraTransition | null = null;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      queueMicrotask(() => setStatus("error"));
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(Math.max(viewerContainer.clientWidth, 1), Math.max(viewerContainer.clientHeight, 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "Modello tridimensionale interattivo di Alette Coffee Table. Usa i pulsanti delle viste per orientarlo.",
    );
    viewerContainer.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35,
      Math.max(viewerContainer.clientWidth, 1) / Math.max(viewerContainer.clientHeight, 1),
      0.01,
      20,
    );
    camera.position.set(1.38, 0.92, 1.38);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 0.19, 0);
    controls.minDistance = 0.72;
    controls.maxDistance = 4;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.autoRotateSpeed = 0.7;

    const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function assembledCameraPose(view: ViewName): CameraPose {
      const target = new THREE.Vector3(0, 0.18, 0);
      if (view === "front") return { position: new THREE.Vector3(0, 0.36, 1.75), target };
      if (view === "side") return { position: new THREE.Vector3(1.75, 0.36, 0), target };
      if (view === "top") {
        return {
          position: new THREE.Vector3(0.001, 2.15, 0.001),
          target: new THREE.Vector3(0, 0.12, 0),
        };
      }
      return { position: new THREE.Vector3(1.38, 0.92, 1.38), target };
    }

    function explodedCameraPose(view: ViewName): CameraPose {
      const target = new THREE.Vector3(0, 0.36, 0);
      if (view === "front") return { position: new THREE.Vector3(0, 0.72, 2.22), target };
      if (view === "side") return { position: new THREE.Vector3(2.22, 0.72, 0), target };
      if (view === "top") {
        return {
          position: new THREE.Vector3(0.001, 2.78, 0.001),
          target: new THREE.Vector3(0, 0.34, 0),
        };
      }
      return { position: new THREE.Vector3(1.82, 1.32, 1.82), target };
    }

    function moveCamera(pose: CameraPose, duration = 620) {
      if (prefersReducedMotion()) {
        cameraTransition = null;
        camera.position.copy(pose.position);
        controls.target.copy(pose.target);
        controls.update();
        return;
      }

      cameraTransition = {
        fromPosition: camera.position.clone(),
        fromTarget: controls.target.clone(),
        position: pose.position.clone(),
        target: pose.target.clone(),
        startedAt: performance.now(),
        duration,
      };
    }

    function cancelCameraTransition() {
      cameraTransition = null;
    }

    controls.addEventListener("start", cancelCameraTransition);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentTarget = pmrem.fromScene(roomEnvironment, 0.04);
    scene.environment = environmentTarget.texture;
    roomEnvironment.dispose();
    pmrem.dispose();

    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x7d756b, 1.15);
    scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(2.5, 4.2, 2.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 10;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff1df, 0.75);
    fillLight.position.set(-2.5, 1.8, -1.5);
    scene.add(fillLight);

    const floorGeometry = new THREE.CircleGeometry(3.2, 96);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e3dc,
      roughness: 0.96,
      metalness: 0,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    floor.receiveShadow = true;
    scene.add(floor);

    const shadowMaterial = new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: initialEnvironmentPlacement.shadow,
      transparent: true,
      depthWrite: false,
    });
    const shadowFloor = new THREE.Mesh(floorGeometry, shadowMaterial);
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -0.001;
    shadowFloor.receiveShadow = true;
    shadowFloor.visible = false;
    scene.add(shadowFloor);

    const textureLoader = new THREE.TextureLoader();

    function getBaseTexture(material: StoneMaterial) {
      let promise = texturePromises.get(material.id);
      if (!promise) {
        promise = textureLoader.loadAsync(material.texture).then((texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 12);
          return texture;
        });
        texturePromises.set(material.id, promise);
      }
      return promise;
    }

    function updateMapScale(texture: THREE.Texture, partId: AlettePartId, scale: number) {
      const image = texture.image as { width?: number; height?: number } | undefined;
      const aspect = image?.width && image?.height ? image.width / image.height : 1;
      const repetitions = 1 / scale;
      texture.repeat.set(repetitions, repetitions * aspect);
      texture.offset.set(...partTextureOffsets[partId]);
      texture.needsUpdate = true;
    }

    async function applyMaterial(partId: AlettePartId, materialId: string) {
      const mesh = meshes.get(partId);
      const part = aletteCoffee.parts.find((entry) => entry.id === partId);
      const material = stoneMaterials.find((entry) => entry.id === materialId);
      if (!mesh || !part || !material || !material.allowedOn.includes(part.role)) return;

      const requestId = (materialRequest.get(partId) ?? 0) + 1;
      materialRequest.set(partId, requestId);

      try {
        const baseTexture = await getBaseTexture(material);
        if (disposed || materialRequest.get(partId) !== requestId) return;

        const texture = baseTexture.clone();
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        updateMapScale(texture, partId, textureScaleRef.current);

        const nextMaterial = new THREE.MeshPhysicalMaterial({
          map: texture,
          color: 0xffffff,
          roughness: material.roughness,
          metalness: 0,
          clearcoat: part.role === "plane" ? 0.08 : 0.04,
          clearcoatRoughness: 0.55,
          envMapIntensity: 0.65,
          side: THREE.DoubleSide,
        });

        if (mesh.material) disposeMaterial(mesh.material);
        mesh.material = nextMaterial;
      } catch {
        if (!disposed) queueMicrotask(() => setStatus("error"));
      }
    }

    function updateTextureScale(scale: number) {
      for (const [partId, mesh] of meshes.entries()) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material.map) updateMapScale(material.map, partId, scale);
      }
    }

    function setExposureValue(value: number) {
      renderer.toneMappingExposure = value;
    }

    function applyEnvironmentProjection(placement = currentEnvironmentPlacement) {
      currentEnvironmentPlacement = placement;
      camera.zoom = environmentEnabled ? placement.scale : 1;

      if (environmentEnabled) {
        const width = Math.max(viewerContainer.clientWidth, 1);
        const height = Math.max(viewerContainer.clientHeight, 1);
        camera.setViewOffset(
          width,
          height,
          (-placement.x / 100) * width,
          (placement.y / 100) * height,
          width,
          height,
        );
      } else {
        camera.clearViewOffset();
      }

      camera.updateProjectionMatrix();
      floor.visible = !environmentEnabled;
      shadowFloor.visible = environmentEnabled;
      shadowMaterial.opacity = placement.shadow;
      shadowMaterial.needsUpdate = true;
    }

    function setEnvironmentEnabledValue(value: boolean) {
      environmentEnabled = value;
      applyEnvironmentProjection(currentEnvironmentPlacement);
    }

    function clearExplodeTimers() {
      for (const timer of explodeTimers) window.clearTimeout(timer);
      explodeTimers.clear();
    }

    function scheduleExplodeStep(step: () => void, delay: number) {
      if (prefersReducedMotion()) {
        step();
        return;
      }
      const timer = window.setTimeout(() => {
        explodeTimers.delete(timer);
        step();
      }, delay);
      explodeTimers.add(timer);
    }

    function setPartExploded(partId: AlettePartId, value: boolean) {
      const mesh = meshes.get(partId);
      const part = aletteCoffee.parts.find((entry) => entry.id === partId);
      if (!mesh || !part) return;
      const base = mesh.userData.basePosition as THREE.Vector3;
      const target = value
        ? base.clone().add(new THREE.Vector3(...part.explodeOffset))
        : base.clone();
      mesh.userData.targetPosition = target;
      if (prefersReducedMotion()) mesh.position.copy(target);
    }

    function setExplodedView(value: boolean) {
      clearExplodeTimers();

      if (value && !explodedViewActive) {
        cameraBeforeExplode = {
          position: camera.position.clone(),
          target: controls.target.clone(),
        };
      }

      explodedViewActive = value;
      setPartExploded("leg-a", false);

      if (value) {
        // Sequenza di smontaggio: si libera la piana, poi emerge il mezzo incastro delle gambe.
        setPartExploded("top", true);
        scheduleExplodeStep(() => setPartExploded("leg-b", true), 260);
        moveCamera(explodedCameraPose(activeCameraView));
      } else {
        // Chiusura inversa: prima le gambe, poi la piana torna sui quattro tenoni.
        setPartExploded("leg-b", false);
        scheduleExplodeStep(() => setPartExploded("top", false), 260);
        moveCamera(cameraBeforeExplode ?? assembledCameraPose(activeCameraView));
        cameraBeforeExplode = null;
      }
    }

    function setView(view: ViewName) {
      activeCameraView = view;
      const assembledPose = assembledCameraPose(view);
      if (explodedViewActive) cameraBeforeExplode = assembledPose;
      moveCamera(explodedViewActive ? explodedCameraPose(view) : assembledPose, 480);
    }

    function saveImage() {
      const environmentImage = environmentImageRef.current;
      if (environmentEnabled && (!environmentImage || !environmentImage.complete)) {
        setExportMessage("Attendi che la fotografia sia pronta prima di salvare.");
        return;
      }

      setExportMessage("Preparo l’immagine…");
      renderer.render(scene, camera);

      const output = document.createElement("canvas");
      output.width = renderer.domElement.width;
      output.height = renderer.domElement.height;
      const context = output.getContext("2d");
      if (!context) {
        setExportMessage("Non sono riuscito a creare l’immagine. Riprova.");
        return;
      }

      if (environmentEnabled && environmentImage) {
        drawImageCover(context, environmentImage, output.width, output.height);
      }
      context.drawImage(renderer.domElement, 0, 0, output.width, output.height);

      output.toBlob((blob) => {
        if (disposed) return;
        if (!blob) {
          setExportMessage("Non sono riuscito a creare l’immagine. Riprova.");
          return;
        }

        const downloadUrl = URL.createObjectURL(blob);
        downloadUrls.add(downloadUrl);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = environmentEnabled
          ? `riviera-design-alette-ambiente-${Date.now()}.png`
          : `riviera-design-alette-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setExportMessage("Immagine salvata sul dispositivo.");

        const feedbackTimer = window.setTimeout(() => {
          feedbackTimers.delete(feedbackTimer);
          if (!disposed) setExportMessage("");
        }, 3200);
        feedbackTimers.add(feedbackTimer);

        window.setTimeout(() => {
          URL.revokeObjectURL(downloadUrl);
          downloadUrls.delete(downloadUrl);
        }, 0);
      }, "image/png");
    }

    actionsRef.current = {
      applyMaterial,
      updateTextureScale,
      setExposure: setExposureValue,
      setExploded: setExplodedView,
      setAutoRotate: (value) => {
        controls.autoRotate = value && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      },
      setView,
      setEnvironmentEnabled: setEnvironmentEnabledValue,
      updateEnvironmentPlacement: applyEnvironmentProjection,
      saveImage,
    };

    const loader = new GLTFLoader();
    loader
      .loadAsync(aletteCoffee.model)
      .then(async (gltf) => {
        if (disposed) return;
        scene.add(gltf.scene);

        for (const part of aletteCoffee.parts) {
          const object = gltf.scene.getObjectByName(part.meshName);
          if (!(object instanceof THREE.Mesh)) throw new Error(`Componente mancante: ${part.meshName}`);
          prepareGeometry(object, part);
          object.castShadow = true;
          object.receiveShadow = true;
          object.userData.basePosition = object.position.clone();
          object.userData.targetPosition = object.position.clone();
          meshes.set(part.id, object);
        }

        await Promise.all(
          aletteCoffee.parts.map((part) => applyMaterial(part.id, materialsRef.current[part.id])),
        );
        if (!disposed) setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });

    let pointerStart = { x: 0, y: 0 };
    function onPointerDown(event: PointerEvent) {
      pointerStart = { x: event.clientX, y: event.clientY };
    }

    function onPointerUp(event: PointerEvent) {
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
      if (!hit) return;
      const part = aletteCoffee.parts.find((entry) => entry.meshName === hit.object.name);
      if (part) setSelectedPart(part.id);
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(viewerContainer.clientWidth, 1);
      const height = Math.max(viewerContainer.clientHeight, 1);
      camera.aspect = width / height;
      renderer.setSize(width, height, false);
      applyEnvironmentProjection(currentEnvironmentPlacement);
    });
    resizeObserver.observe(viewerContainer);

    function render(now = performance.now()) {
      if (cameraTransition) {
        const progress = Math.min((now - cameraTransition.startedAt) / cameraTransition.duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(cameraTransition.fromPosition, cameraTransition.position, eased);
        controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.target, eased);
        if (progress >= 1) cameraTransition = null;
      }

      for (const mesh of meshes.values()) {
        const target = mesh.userData.targetPosition as THREE.Vector3 | undefined;
        if (!target) continue;
        if (prefersReducedMotion()) mesh.position.copy(target);
        else {
          mesh.position.lerp(target, 0.1);
          if (mesh.position.distanceToSquared(target) < 0.0000001) mesh.position.copy(target);
        }
      }
      controls.update();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    }
    render();

    return () => {
      disposed = true;
      actionsRef.current = null;
      window.cancelAnimationFrame(animationFrame);
      clearExplodeTimers();
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("start", cancelCameraTransition);
      controls.dispose();
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        if (mesh.material) disposeMaterial(mesh.material);
      }
      for (const promise of texturePromises.values()) promise.then((texture) => texture.dispose()).catch(() => undefined);
      for (const downloadUrl of downloadUrls) URL.revokeObjectURL(downloadUrl);
      downloadUrls.clear();
      for (const feedbackTimer of feedbackTimers) window.clearTimeout(feedbackTimer);
      feedbackTimers.clear();
      floorGeometry.dispose();
      floorMaterial.dispose();
      shadowMaterial.dispose();
      environmentTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  function openEnvironmentPicker() {
    if (status !== "ready" || environmentStatus === "loading") return;
    setEnvironmentError(null);
    if (environmentInputRef.current) {
      environmentInputRef.current.value = "";
      environmentInputRef.current.click();
    }
  }

  function handleEnvironmentFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!environmentFileTypes.includes(file.type)) {
      setEnvironmentError("Formato non supportato. Usa una foto JPG, PNG o WebP.");
      setEnvironmentStatus(environmentUrlRef.current ? "ready" : "error");
      return;
    }
    if (file.size === 0) {
      setEnvironmentError("La fotografia è vuota. Scegli un altro file.");
      setEnvironmentStatus(environmentUrlRef.current ? "ready" : "error");
      return;
    }
    if (file.size > environmentFileMaxBytes) {
      setEnvironmentError("La foto supera 20 MB. Scegli un file più leggero.");
      setEnvironmentStatus(environmentUrlRef.current ? "ready" : "error");
      return;
    }

    const requestId = environmentLoadRequestRef.current + 1;
    environmentLoadRequestRef.current = requestId;
    if (environmentPendingUrlRef.current) URL.revokeObjectURL(environmentPendingUrlRef.current);

    const candidateUrl = URL.createObjectURL(file);
    environmentPendingUrlRef.current = candidateUrl;
    setEnvironmentStatus("loading");
    setEnvironmentError(null);
    setExportMessage("");

    const candidate = new Image();
    candidate.decoding = "async";
    candidate.onload = () => {
      if (environmentLoadRequestRef.current !== requestId) {
        URL.revokeObjectURL(candidateUrl);
        return;
      }

      if (
        candidate.naturalWidth < 1
        || candidate.naturalHeight < 1
        || candidate.naturalWidth * candidate.naturalHeight > environmentImageMaxPixels
      ) {
        URL.revokeObjectURL(candidateUrl);
        environmentPendingUrlRef.current = null;
        setEnvironmentError("La foto è troppo grande per questo dispositivo. Prova una versione più piccola.");
        setEnvironmentStatus(environmentUrlRef.current ? "ready" : "error");
        return;
      }

      const previousUrl = environmentUrlRef.current;
      environmentPendingUrlRef.current = null;
      environmentUrlRef.current = candidateUrl;
      setEnvironmentUrl(candidateUrl);
      setEnvironmentStatus("ready");
      setEnvironmentError(null);
      actionsRef.current?.setEnvironmentEnabled(true);
      actionsRef.current?.updateEnvironmentPlacement(environmentPlacementRef.current);
      if (previousUrl && previousUrl !== candidateUrl) {
        window.setTimeout(() => URL.revokeObjectURL(previousUrl), 0);
      }
    };
    candidate.onerror = () => {
      URL.revokeObjectURL(candidateUrl);
      if (environmentLoadRequestRef.current !== requestId) return;
      environmentPendingUrlRef.current = null;
      setEnvironmentError("Non riesco a leggere questa foto. Prova con un altro file o esportala in JPG.");
      setEnvironmentStatus(environmentUrlRef.current ? "ready" : "error");
    };
    candidate.src = candidateUrl;
  }

  function changeEnvironmentPlacement(
    property: keyof EnvironmentPlacement,
    value: number,
  ) {
    const next = { ...environmentPlacementRef.current, [property]: value };
    environmentPlacementRef.current = next;
    setEnvironmentPlacement(next);
    actionsRef.current?.updateEnvironmentPlacement(next);
  }

  function resetEnvironmentPlacement() {
    environmentPlacementRef.current = initialEnvironmentPlacement;
    setEnvironmentPlacement(initialEnvironmentPlacement);
    actionsRef.current?.updateEnvironmentPlacement(initialEnvironmentPlacement);
  }

  function removeEnvironment() {
    environmentLoadRequestRef.current += 1;
    if (environmentPendingUrlRef.current) URL.revokeObjectURL(environmentPendingUrlRef.current);
    if (environmentUrlRef.current) URL.revokeObjectURL(environmentUrlRef.current);
    environmentPendingUrlRef.current = null;
    environmentUrlRef.current = null;
    environmentPlacementRef.current = initialEnvironmentPlacement;
    setEnvironmentUrl(null);
    setEnvironmentStatus("idle");
    setEnvironmentError(null);
    setEnvironmentPlacement(initialEnvironmentPlacement);
    setExportMessage("");
    actionsRef.current?.setEnvironmentEnabled(false);
    actionsRef.current?.updateEnvironmentPlacement(initialEnvironmentPlacement);
    if (environmentInputRef.current) environmentInputRef.current.value = "";
  }

  function choosePart(partId: AlettePartId, moveFocus = false) {
    setSelectedPart(partId);
    if (moveFocus) window.requestAnimationFrame(() => partButtons.current[partId]?.focus());
  }

  function handlePartKeys(event: KeyboardEvent<HTMLButtonElement>, partId: AlettePartId) {
    const ids = aletteCoffee.parts.map((part) => part.id);
    const index = ids.indexOf(partId);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % ids.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + ids.length) % ids.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = ids.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    choosePart(ids[nextIndex], true);
  }

  function chooseMaterial(material: StoneMaterial) {
    if (!material.allowedOn.includes(selectedPartDefinition.role)) return;
    const next = { ...partMaterials, [selectedPart]: material.id };
    materialsRef.current = next;
    setPartMaterials(next);
    void actionsRef.current?.applyMaterial(selectedPart, material.id);
  }

  function applyEverywhere() {
    if (!canApplyEverywhere) return;
    const next: PartMaterials = {
      top: selectedMaterial.id,
      "leg-a": selectedMaterial.id,
      "leg-b": selectedMaterial.id,
    };
    materialsRef.current = next;
    setPartMaterials(next);
    for (const part of aletteCoffee.parts) void actionsRef.current?.applyMaterial(part.id, selectedMaterial.id);
  }

  function changeTextureScale(value: number) {
    textureScaleRef.current = value;
    setTextureScale(value);
    actionsRef.current?.updateTextureScale(value);
  }

  function changeExposure(value: number) {
    setExposure(value);
    actionsRef.current?.setExposure(value);
  }

  function toggleExploded() {
    if (status !== "ready") return;
    const next = !exploded;
    setExploded(next);
    actionsRef.current?.setExploded(next);
  }

  function toggleAutoRotate() {
    if (status !== "ready") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAutoRotate(false);
      actionsRef.current?.setAutoRotate(false);
      return;
    }
    const next = !autoRotate;
    setAutoRotate(next);
    actionsRef.current?.setAutoRotate(next);
  }

  function chooseView(view: ViewName) {
    if (status !== "ready") return;
    setActiveView(view);
    actionsRef.current?.setView(view);
  }

  function resetView() {
    setExploded(false);
    setAutoRotate(false);
    setActiveView("perspective");
    removeEnvironment();
    actionsRef.current?.setExploded(false);
    actionsRef.current?.setAutoRotate(false);
    actionsRef.current?.setView("perspective");
  }

  return (
    <section className="atelier-configurator" aria-labelledby="configurator-title">
      <div className="viewer-panel">
        <div className="viewer-meta">
          <span>Modello Rev. {aletteCoffee.revision}</span>
          <span>{aletteCoffee.dimensions}</span>
        </div>
        <div className={`viewer-canvas ${environmentUrl ? "has-environment" : ""}`}>
          {environmentUrl && (
            <img
              ref={environmentImageRef}
              className="environment-photo"
              src={environmentUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          )}
          <div className="viewer-webgl-layer" ref={viewerRef} />
          {status !== "ready" && (
            <div className={`viewer-loading ${status === "error" ? "has-error" : ""}`} role="status">
              <span className="loading-line" aria-hidden="true" />
              <strong>{status === "error" ? "Modello non disponibile" : "Preparo la materia"}</strong>
              <p>
                {status === "error"
                  ? "Ricarica la pagina. Se il problema continua, verifica che l’Atelier sia stato aperto dal collegamento dedicato."
                  : "Caricamento della geometria Alette Coffee…"}
              </p>
            </div>
          )}
          {exportMessage && (
            <p className="viewer-feedback" role="status" aria-live="polite">{exportMessage}</p>
          )}
        </div>

        <div className="viewer-toolbar" aria-label="Controlli del modello tridimensionale">
          <div className="view-buttons" aria-label="Viste">
            {(
              [
                ["perspective", "Prospettiva"],
                ["front", "Frontale"],
                ["side", "Laterale"],
                ["top", "Alto"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={activeView === id ? "is-active" : ""}
                aria-pressed={activeView === id}
                disabled={status !== "ready"}
                onClick={() => chooseView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="viewer-actions">
            <button type="button" aria-pressed={exploded} disabled={status !== "ready"} onClick={toggleExploded}>Esploso</button>
            <button type="button" aria-pressed={autoRotate} disabled={status !== "ready"} onClick={toggleAutoRotate}>Rotazione</button>
            <input
              ref={environmentInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleEnvironmentFile}
            />
            <button
              type="button"
              aria-pressed={Boolean(environmentUrl)}
              disabled={status !== "ready" || environmentStatus === "loading"}
              onClick={openEnvironmentPicker}
            >
              Ambiente
            </button>
            <button type="button" disabled={status !== "ready"} onClick={resetView}>Reimposta vista</button>
            <button
              type="button"
              disabled={status !== "ready" || environmentStatus === "loading"}
              onClick={() => actionsRef.current?.saveImage()}
            >
              Salva immagine
            </button>
          </div>
        </div>
      </div>

      <aside className="configuration-panel">
        <div className="configuration-heading">
          <p className="eyebrow">02 — Componi il tuo Alette</p>
          <h2 id="configurator-title">Materia,<br />elemento per elemento</h2>
          <p>Seleziona una parte del tavolo, poi scegli la pietra. Puoi anche toccare direttamente il modello.</p>
        </div>

        {(environmentUrl || environmentStatus === "loading" || environmentError) && (
          <div className="control-section environment-controls" aria-labelledby="environment-controls-title">
            <div className="control-title">
              <span>A</span>
              <strong id="environment-controls-title">Ambiente reale</strong>
            </div>

            {environmentStatus === "loading" && (
              <p className="environment-status" role="status">Preparo la fotografia dell’ambiente…</p>
            )}
            {environmentError && (
              <p className="environment-error" role="alert">{environmentError}</p>
            )}

            {environmentUrl && (
              <>
                <p className="environment-ready">Foto pronta. Regola il tavolo per inserirlo visivamente nello spazio.</p>
                <label>
                  <span>Dimensione tavolo</span>
                  <output aria-hidden="true">{Math.round(environmentPlacement.scale * 100)}%</output>
                  <input
                    type="range"
                    aria-label="Dimensione tavolo"
                    aria-valuetext={`${Math.round(environmentPlacement.scale * 100)}%`}
                    min="0.65"
                    max="1.45"
                    step="0.01"
                    value={environmentPlacement.scale}
                    onChange={(event) => changeEnvironmentPlacement("scale", Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>Posizione orizzontale</span>
                  <output aria-hidden="true">{environmentPlacement.x > 0 ? "+" : ""}{environmentPlacement.x}</output>
                  <input
                    type="range"
                    aria-label="Posizione orizzontale"
                    aria-valuetext={environmentPlacement.x === 0 ? "Centro" : `${environmentPlacement.x}`}
                    min="-30"
                    max="30"
                    step="1"
                    value={environmentPlacement.x}
                    onChange={(event) => changeEnvironmentPlacement("x", Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>Posizione verticale</span>
                  <output aria-hidden="true">{environmentPlacement.y > 0 ? "+" : ""}{environmentPlacement.y}</output>
                  <input
                    type="range"
                    aria-label="Posizione verticale"
                    aria-valuetext={environmentPlacement.y === 0 ? "Centro" : `${environmentPlacement.y}`}
                    min="-25"
                    max="25"
                    step="1"
                    value={environmentPlacement.y}
                    onChange={(event) => changeEnvironmentPlacement("y", Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>Intensità ombra</span>
                  <output aria-hidden="true">{Math.round(environmentPlacement.shadow * 100)}%</output>
                  <input
                    type="range"
                    aria-label="Intensità ombra"
                    aria-valuetext={`${Math.round(environmentPlacement.shadow * 100)}%`}
                    min="0"
                    max="0.45"
                    step="0.01"
                    value={environmentPlacement.shadow}
                    onChange={(event) => changeEnvironmentPlacement("shadow", Number(event.target.value))}
                  />
                </label>

                <div className="environment-actions">
                  <button type="button" onClick={resetEnvironmentPlacement}>Centra il tavolo</button>
                  <button type="button" onClick={openEnvironmentPicker}>Sostituisci foto</button>
                  <button type="button" onClick={removeEnvironment}>Rimuovi foto</button>
                </div>
                <p className="environment-note">
                  La foto resta sul tuo dispositivo e non viene caricata né conservata. L’inserimento è
                  un’anteprima visiva, non una misurazione dello spazio.
                </p>
              </>
            )}
          </div>
        )}

        <div className="control-section">
          <div className="control-title">
            <span>01</span>
            <strong>Componente</strong>
          </div>
          <div className="part-tabs" role="radiogroup" aria-label="Componente da configurare">
            {aletteCoffee.parts.map((part) => (
              <button
                key={part.id}
                ref={(element) => { partButtons.current[part.id] = element; }}
                type="button"
                role="radio"
                aria-checked={selectedPart === part.id}
                tabIndex={selectedPart === part.id ? 0 : -1}
                className={selectedPart === part.id ? "is-active" : ""}
                onKeyDown={(event) => handlePartKeys(event, part.id)}
                onClick={() => choosePart(part.id)}
              >
                <span>{part.shortLabel}</span>
                <small>{part.role === "plane" ? "Piano" : "Gamba"}</small>
              </button>
            ))}
          </div>
          <p className="part-specification">{selectedPartDefinition.specification}</p>
        </div>

        <div className="control-section materials-section">
          <div className="control-title">
            <span>02</span>
            <strong>Pietra</strong>
          </div>
          <div className="current-material">
            <span style={{ backgroundImage: `url(${selectedMaterial.texture})` }} aria-hidden="true" />
            <div>
              <small>{selectedPartDefinition.label}</small>
              <strong>{selectedMaterial.name}</strong>
            </div>
          </div>

          <div className="material-grid" aria-label={`Pietre per ${selectedPartDefinition.label}`}>
            {stoneMaterials.map((material) => {
              const allowed = material.allowedOn.includes(selectedPartDefinition.role);
              const active = selectedMaterial.id === material.id;
              return (
                <button
                  key={material.id}
                  type="button"
                  className={active ? "is-active" : ""}
                  disabled={!allowed}
                  aria-pressed={active}
                  title={allowed ? material.name : `${material.name}: disponibile solo per i piani`}
                  onClick={() => chooseMaterial(material)}
                >
                  <span className="material-thumb">
                    <img src={material.texture} alt="" loading="lazy" />
                  </span>
                  <span className="material-name">{material.name}</span>
                  {!allowed && <small>Solo piani</small>}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="apply-all"
            disabled={!canApplyEverywhere}
            onClick={applyEverywhere}
          >
            <span>{canApplyEverywhere ? "Applica ai tre elementi" : "Disponibile solo per la piana"}</span>
            <span aria-hidden="true">→</span>
          </button>
          {!canApplyEverywhere && (
            <p className="material-restriction">Questa pietra non viene proposta per le gambe.</p>
          )}
        </div>

        <div className="control-section rendering-controls">
          <div className="control-title">
            <span>03</span>
            <strong>Resa indicativa</strong>
          </div>
          <label>
            <span>Scala venatura</span>
            <output>{Math.round(textureScale * 100)}%</output>
            <input
              type="range"
              min="0.55"
              max="1.8"
              step="0.05"
              value={textureScale}
              onChange={(event) => changeTextureScale(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Luce ambiente</span>
            <output>{Math.round(exposure * 100)}%</output>
            <input
              type="range"
              min="0.65"
              max="1.35"
              step="0.05"
              value={exposure}
              onChange={(event) => changeExposure(Number(event.target.value))}
            />
          </label>
          <p>Ogni lastra naturale è unica. Venature, tono e disposizione reale saranno verificati sulla lastra selezionata.</p>
        </div>
      </aside>
    </section>
  );
}
