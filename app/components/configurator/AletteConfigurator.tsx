"use client";

/* eslint-disable @next/next/no-img-element -- Le texture locali devono restare immagini dirette per il configuratore WebGL. */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
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
  type AtelierPartId,
  type AtelierProduct,
  type AtelierProductId,
  type ProductPart,
  type StoneMaterial,
} from "../../data/atelier-catalog";

type ViewName = "perspective" | "front" | "side" | "top";
type LoadStatus = "loading" | "ready" | "error";
type EnvironmentStatus = "idle" | "loading" | "ready" | "error";
type PartMaterials = Partial<Record<AtelierPartId, string>>;

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
  applyMaterial: (
    partId: AtelierPartId,
    materialId: string,
  ) => Promise<void>;
  updateTextureScale: (scale: number) => void;
  setExposure: (value: number) => void;
  setExploded: (value: boolean) => void;
  setAutoRotate: (value: boolean) => void;
  setView: (view: ViewName) => void;
  setEnvironmentEnabled: (value: boolean) => void;
  updateEnvironmentPlacement: (placement: EnvironmentPlacement) => void;
  saveImage: () => void;
};

const DEFAULT_MATERIAL_ID = "bianco-carrara";

const initialEnvironmentPlacement: EnvironmentPlacement = {
  x: 0,
  y: 0,
  scale: 1,
  shadow: 0.22,
};

const environmentFileTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const environmentFileMaxBytes = 20 * 1024 * 1024;
const environmentImageMaxPixels = 40_000_000;

const partTextureOffsets: Record<
  AtelierPartId,
  readonly [number, number]
> = {
  top: [0.03, 0.06],
  subtop: [0.11, 0.14],
  "leg-a": [0.17, 0.11],
  "leg-b": [0.31, 0.23],
};

function createInitialMaterials(
  product: AtelierProduct,
): PartMaterials {
  return Object.fromEntries(
    product.parts.map((part) => [
      part.id,
      DEFAULT_MATERIAL_ID,
    ]),
  ) as PartMaterials;
}

function disposeMaterial(
  material: THREE.Material | THREE.Material[],
) {
  const materials = Array.isArray(material)
    ? material
    : [material];

  for (const item of materials) {
    const mapped = item as THREE.MeshStandardMaterial;
    mapped.map?.dispose();
    item.dispose();
  }
}

function prepareGeometry(
  mesh: THREE.Mesh,
  part: ProductPart,
) {
  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);

    if (part.role === "plane") {
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

  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(uv, 2),
  );
  geometry.computeVertexNormals();
  mesh.geometry = geometry;
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight,
  );

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
  const initialProduct = atelierProducts["riviera-coffee"];

  const viewerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<ViewerActions | null>(null);

  const materialsRef = useRef<PartMaterials>(
    createInitialMaterials(initialProduct),
  );

  const textureScaleRef = useRef(1);

  const partButtons = useRef<
    Partial<
      Record<AtelierPartId, HTMLButtonElement | null>
    >
  >({});

  const environmentInputRef =
    useRef<HTMLInputElement>(null);

  const environmentImageRef =
    useRef<HTMLImageElement>(null);

  const environmentUrlRef = useRef<string | null>(null);

  const environmentPendingUrlRef =
    useRef<string | null>(null);

  const environmentLoadRequestRef = useRef(0);

  const environmentPlacementRef =
    useRef<EnvironmentPlacement>(
      initialEnvironmentPlacement,
    );

  const [selectedProductId, setSelectedProductId] =
    useState<AtelierProductId>("riviera-coffee");

  const selectedProduct =
    atelierProducts[selectedProductId];

  const [status, setStatus] =
    useState<LoadStatus>("loading");

  const [selectedPart, setSelectedPart] =
    useState<AtelierPartId>("top");

  const [partMaterials, setPartMaterials] =
    useState<PartMaterials>(
      createInitialMaterials(initialProduct),
    );

  const [textureScale, setTextureScale] = useState(1);
  const [exposure, setExposure] = useState(1);
  const [exploded, setExploded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  const [activeView, setActiveView] =
    useState<ViewName>("perspective");

  const [environmentUrl, setEnvironmentUrl] =
    useState<string | null>(null);

  const [environmentStatus, setEnvironmentStatus] =
    useState<EnvironmentStatus>("idle");

  const [environmentError, setEnvironmentError] =
    useState<string | null>(null);

  const [environmentPlacement, setEnvironmentPlacement] =
    useState<EnvironmentPlacement>(
      initialEnvironmentPlacement,
    );

  const [exportMessage, setExportMessage] =
    useState("");

  const selectedPartDefinition = useMemo(
    () =>
      selectedProduct.parts.find(
        (part) => part.id === selectedPart,
      ) ?? selectedProduct.parts[0],
    [selectedPart, selectedProduct],
  );

  const selectedMaterial = useMemo(() => {
    const materialId =
      partMaterials[selectedPart] ??
      DEFAULT_MATERIAL_ID;

    return (
      stoneMaterials.find(
        (material) => material.id === materialId,
      ) ?? stoneMaterials[0]
    );
  }, [partMaterials, selectedPart]);

  const canApplyEverywhere = selectedProduct.parts.every(
    (part) =>
      selectedMaterial.allowedOn.includes(part.role),
  );

  useEffect(() => {
    materialsRef.current = partMaterials;
  }, [partMaterials]);

  useEffect(() => {
    textureScaleRef.current = textureScale;
  }, [textureScale]);

  useEffect(
    () => () => {
      environmentLoadRequestRef.current += 1;

      if (environmentPendingUrlRef.current) {
        URL.revokeObjectURL(
          environmentPendingUrlRef.current,
        );
      }

      if (environmentUrlRef.current) {
        URL.revokeObjectURL(environmentUrlRef.current);
      }

      environmentPendingUrlRef.current = null;
      environmentUrlRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;

    const viewerContainer = container;

    let disposed = false;
    let animationFrame = 0;
    let explodedViewActive = false;
    let environmentEnabled = false;

    let currentEnvironmentPlacement =
      environmentPlacementRef.current;

    let activeCameraView: ViewName = "perspective";
    let cameraBeforeExplode: CameraPose | null = null;
    let cameraTransition: CameraTransition | null = null;

    const meshes = new Map<
      AtelierPartId,
      THREE.Mesh
    >();

    const texturePromises = new Map<
      string,
      Promise<THREE.Texture>
    >();

    const materialRequest = new Map<
      AtelierPartId,
      number
    >();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const explodeTimers = new Set<number>();
    const downloadUrls = new Set<string>();
    const feedbackTimers = new Set<number>();

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

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2),
    );

    renderer.setSize(
      Math.max(viewerContainer.clientWidth, 1),
      Math.max(viewerContainer.clientHeight, 1),
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;

    renderer.domElement.setAttribute("role", "img");

    renderer.domElement.setAttribute(
      "aria-label",
      `Modello tridimensionale interattivo di ${selectedProduct.name}. Usa i pulsanti delle viste per orientarlo.`,
    );

    viewerContainer.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      35,
      Math.max(viewerContainer.clientWidth, 1) /
        Math.max(viewerContainer.clientHeight, 1),
      0.01,
      30,
    );

    camera.position.set(1.38, 0.92, 1.38);

    const controls = new OrbitControls(
      camera,
      renderer.domElement,
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 0.19, 0);
    controls.minDistance = 0.5;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.autoRotateSpeed = 0.7;

    const prefersReducedMotion = () =>
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    function assembledCameraPose(
      view: ViewName,
    ): CameraPose {
      const target = new THREE.Vector3(0, 0.18, 0);

      if (view === "front") {
        return {
          position: new THREE.Vector3(0, 0.36, 1.75),
          target,
        };
      }

      if (view === "side") {
        return {
          position: new THREE.Vector3(1.75, 0.36, 0),
          target,
        };
      }

      if (view === "top") {
        return {
          position: new THREE.Vector3(
            0.001,
            2.15,
            0.001,
          ),
          target: new THREE.Vector3(0, 0.12, 0),
        };
      }

      return {
        position: new THREE.Vector3(
          1.38,
          0.92,
          1.38,
        ),
        target,
      };
    }

    function explodedCameraPose(
      view: ViewName,
    ): CameraPose {
      const target = new THREE.Vector3(0, 0.36, 0);

      if (view === "front") {
        return {
          position: new THREE.Vector3(0, 0.72, 2.22),
          target,
        };
      }

      if (view === "side") {
        return {
          position: new THREE.Vector3(2.22, 0.72, 0),
          target,
        };
      }

      if (view === "top") {
        return {
          position: new THREE.Vector3(
            0.001,
            2.78,
            0.001,
          ),
          target: new THREE.Vector3(0, 0.34, 0),
        };
      }

      return {
        position: new THREE.Vector3(
          1.82,
          1.32,
          1.82,
        ),
        target,
      };
    }

    function moveCamera(
      pose: CameraPose,
      duration = 620,
    ) {
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

    controls.addEventListener(
      "start",
      cancelCameraTransition,
    );

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();

    const environmentTarget = pmrem.fromScene(
      roomEnvironment,
      0.04,
    );

    scene.environment = environmentTarget.texture;

    roomEnvironment.dispose();
    pmrem.dispose();

    const hemisphere = new THREE.HemisphereLight(
      0xffffff,
      0x7d756b,
      1.15,
    );

    scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(
      0xffffff,
      2.4,
    );

    keyLight.position.set(2.5, 4.2, 2.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 10;

    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(
      0xfff1df,
      0.75,
    );

    fillLight.position.set(-2.5, 1.8, -1.5);
    scene.add(fillLight);

    const floorGeometry = new THREE.CircleGeometry(
      3.2,
      96,
    );

    const floorMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xe8e3dc,
        roughness: 0.96,
        metalness: 0,
      });

    const floor = new THREE.Mesh(
      floorGeometry,
      floorMaterial,
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    floor.receiveShadow = true;

    scene.add(floor);

    const shadowMaterial = new THREE.ShadowMaterial({
      color: 0x000000,
      opacity:
        environmentPlacementRef.current.shadow,
      transparent: true,
      depthWrite: false,
    });

    const shadowFloor = new THREE.Mesh(
      floorGeometry,
      shadowMaterial,
    );

    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -0.001;
    shadowFloor.receiveShadow = true;
    shadowFloor.visible = false;

    scene.add(shadowFloor);

    const textureLoader = new THREE.TextureLoader();

    function getBaseTexture(
      material: StoneMaterial,
    ) {
      let promise = texturePromises.get(material.id);

      if (!promise) {
        promise = textureLoader
          .loadAsync(material.texture)
          .then((texture) => {
            texture.colorSpace =
              THREE.SRGBColorSpace;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;

            texture.anisotropy = Math.min(
              renderer.capabilities.getMaxAnisotropy(),
              12,
            );

            return texture;
          });

        texturePromises.set(material.id, promise);
      }

      return promise;
    }

    function updateMapScale(
      texture: THREE.Texture,
      partId: AtelierPartId,
      scale: number,
    ) {
      const image = texture.image as
        | { width?: number; height?: number }
        | undefined;

      const aspect =
        image?.width && image?.height
          ? image.width / image.height
          : 1;

      const repetitions = 1 / scale;

      texture.repeat.set(
        repetitions,
        repetitions * aspect,
      );

      texture.offset.set(
        ...(partTextureOffsets[partId] ?? [0, 0]),
      );

      texture.needsUpdate = true;
    }

    async function applyMaterial(
      partId: AtelierPartId,
      materialId: string,
    ) {
      const mesh = meshes.get(partId);

      const part = selectedProduct.parts.find(
        (entry) => entry.id === partId,
      );

      const material = stoneMaterials.find(
        (entry) => entry.id === materialId,
      );

      if (
        !mesh ||
        !part ||
        !material ||
        !material.allowedOn.includes(part.role)
      ) {
        return;
      }

      const requestId =
        (materialRequest.get(partId) ?? 0) + 1;

      materialRequest.set(partId, requestId);

      try {
        const baseTexture =
          await getBaseTexture(material);

        if (
          disposed ||
          materialRequest.get(partId) !== requestId
        ) {
          return;
        }

        const texture = baseTexture.clone();

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        updateMapScale(
          texture,
          partId,
          textureScaleRef.current,
        );

        const nextMaterial =
          new THREE.MeshPhysicalMaterial({
            map: texture,
            color: 0xffffff,
            roughness: material.roughness,
            metalness: 0,
            clearcoat:
              part.role === "plane" ? 0.08 : 0.04,
            clearcoatRoughness: 0.55,
            envMapIntensity: 0.65,
            side: THREE.DoubleSide,
          });

        if (mesh.material) {
          disposeMaterial(mesh.material);
        }

        mesh.material = nextMaterial;
      } catch (error) {
        console.error(
          `[Atelier] Materiale non disponibile per ${partId}:`,
          error,
        );

        if (!disposed) {
          queueMicrotask(() => setStatus("error"));
        }
      }
    }

    function updateTextureScaleValue(
      scale: number,
    ) {
      for (const [partId, mesh] of meshes) {
        const material =
          mesh.material as THREE.MeshStandardMaterial;

        if (material.map) {
          updateMapScale(
            material.map,
            partId,
            scale,
          );
        }
      }
    }

    function applyEnvironmentProjection(
      placement = currentEnvironmentPlacement,
    ) {
      currentEnvironmentPlacement = placement;

      camera.zoom = environmentEnabled
        ? placement.scale
        : 1;

      if (environmentEnabled) {
        const width = Math.max(
          viewerContainer.clientWidth,
          1,
        );

        const height = Math.max(
          viewerContainer.clientHeight,
          1,
        );

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

    function clearExplodeTimers() {
      for (const timer of explodeTimers) {
        window.clearTimeout(timer);
      }

      explodeTimers.clear();
    }

    function setPartExploded(
      partId: AtelierPartId,
      value: boolean,
    ) {
      const mesh = meshes.get(partId);

      const part = selectedProduct.parts.find(
        (entry) => entry.id === partId,
      );

      if (!mesh || !part) return;

      const base =
        mesh.userData.basePosition as THREE.Vector3;

      const target = value
        ? base
            .clone()
            .add(
              new THREE.Vector3(
                ...part.explodeOffset,
              ),
            )
        : base.clone();

      mesh.userData.targetPosition = target;

      if (prefersReducedMotion()) {
        mesh.position.copy(target);
      }
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

      if (value) {
        selectedProduct.parts.forEach(
          (part, index) => {
            const timer = window.setTimeout(
              () => {
                explodeTimers.delete(timer);
                setPartExploded(part.id, true);
              },
              prefersReducedMotion()
                ? 0
                : index * 150,
            );

            explodeTimers.add(timer);
          },
        );

        moveCamera(
          explodedCameraPose(activeCameraView),
        );
      } else {
        [...selectedProduct.parts]
          .reverse()
          .forEach((part, index) => {
            const timer = window.setTimeout(
              () => {
                explodeTimers.delete(timer);
                setPartExploded(part.id, false);
              },
              prefersReducedMotion()
                ? 0
                : index * 120,
            );

            explodeTimers.add(timer);
          });

        moveCamera(
          cameraBeforeExplode ??
            assembledCameraPose(activeCameraView),
        );

        cameraBeforeExplode = null;
      }
    }

    function setView(view: ViewName) {
      activeCameraView = view;

      const assembledPose =
        assembledCameraPose(view);

      if (explodedViewActive) {
        cameraBeforeExplode = assembledPose;
      }

      moveCamera(
        explodedViewActive
          ? explodedCameraPose(view)
          : assembledPose,
        480,
      );
    }

    function saveImage() {
      const environmentImage =
        environmentImageRef.current;

      if (
        environmentEnabled &&
        (!environmentImage ||
          !environmentImage.complete)
      ) {
        setExportMessage(
          "Attendi che la fotografia sia pronta prima di salvare.",
        );
        return;
      }

      setExportMessage("Preparo l’immagine…");
      renderer.render(scene, camera);

      const output =
        document.createElement("canvas");

      output.width = renderer.domElement.width;
      output.height = renderer.domElement.height;

      const context = output.getContext("2d");

      if (!context) {
        setExportMessage(
          "Non sono riuscito a creare l’immagine. Riprova.",
        );
        return;
      }

      if (
        environmentEnabled &&
        environmentImage
      ) {
        drawImageCover(
          context,
          environmentImage,
          output.width,
          output.height,
        );
      }

      context.drawImage(
        renderer.domElement,
        0,
        0,
        output.width,
        output.height,
      );

      output.toBlob((blob) => {
        if (disposed) return;

        if (!blob) {
          setExportMessage(
            "Non sono riuscito a creare l’immagine. Riprova.",
          );
          return;
        }

        const downloadUrl =
          URL.createObjectURL(blob);

        downloadUrls.add(downloadUrl);

        const link = document.createElement("a");

        link.href = downloadUrl;

        link.download = environmentEnabled
          ? `riviera-design-${selectedProduct.id}-ambiente-${Date.now()}.png`
          : `riviera-design-${selectedProduct.id}-${Date.now()}.png`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setExportMessage(
          "Immagine salvata sul dispositivo.",
        );

        const feedbackTimer = window.setTimeout(
          () => {
            feedbackTimers.delete(feedbackTimer);

            if (!disposed) {
              setExportMessage("");
            }
          },
          3200,
        );

        feedbackTimers.add(feedbackTimer);

        window.setTimeout(() => {
          URL.revokeObjectURL(downloadUrl);
          downloadUrls.delete(downloadUrl);
        }, 0);
      }, "image/png");
    }

    actionsRef.current = {
      applyMaterial,
      updateTextureScale: updateTextureScaleValue,
      setExposure: (value) => {
        renderer.toneMappingExposure = value;
      },
      setExploded: setExplodedView,
      setAutoRotate: (value) => {
        controls.autoRotate =
          value && !prefersReducedMotion();
      },
      setView,
      setEnvironmentEnabled: (value) => {
        environmentEnabled = value;
        applyEnvironmentProjection(
          currentEnvironmentPlacement,
        );
      },
      updateEnvironmentPlacement:
        applyEnvironmentProjection,
      saveImage,
    };

    const loader = new GLTFLoader();

    loader
      .loadAsync(selectedProduct.model)
      .then(async (gltf) => {
        if (disposed) return;

        const availableMeshes: string[] = [];

        gltf.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            availableMeshes.push(object.name);
          }
        });

        console.info(
          `[Atelier] Mesh di ${selectedProduct.model}:`,
          availableMeshes,
        );

        scene.add(gltf.scene);

        for (const part of selectedProduct.parts) {
          const object = gltf.scene.getObjectByName(
            part.meshName,
          );

          if (!(object instanceof THREE.Mesh)) {
            throw new Error(
              `Componente "${part.meshName}" non trovato in ${selectedProduct.model}. Mesh disponibili: ${availableMeshes.join(", ")}`,
            );
          }

          prepareGeometry(object, part);
          object.castShadow = true;
          object.receiveShadow = true;

          object.userData.basePosition =
            object.position.clone();

          object.userData.targetPosition =
            object.position.clone();

          meshes.set(part.id, object);
        }

        await Promise.all(
          selectedProduct.parts.map((part) =>
            applyMaterial(
              part.id,
              materialsRef.current[part.id] ??
                DEFAULT_MATERIAL_ID,
            ),
          ),
        );

        if (!disposed) {
          setStatus("ready");
        }
      })
      .catch((error: unknown) => {
        console.error(
          `[Atelier] Impossibile caricare ${selectedProduct.model}:`,
          error,
        );

        if (!disposed) {
          setStatus("error");
        }
      });

    let pointerStart = { x: 0, y: 0 };

    function onPointerDown(event: PointerEvent) {
      pointerStart = {
        x: event.clientX,
        y: event.clientY,
      };
    }

    function onPointerUp(event: PointerEvent) {
      if (
        Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y,
        ) > 5
      ) {
        return;
      }

      const rect =
        renderer.domElement.getBoundingClientRect();

      pointer.x =
        ((event.clientX - rect.left) /
          rect.width) *
          2 -
        1;

      pointer.y =
        -((event.clientY - rect.top) /
          rect.height) *
          2 +
        1;

      raycaster.setFromCamera(pointer, camera);

      const hit = raycaster.intersectObjects(
        [...meshes.values()],
        false,
      )[0];

      if (!hit) return;

      const part = selectedProduct.parts.find(
        (entry) =>
          entry.meshName === hit.object.name,
      );

      if (part) {
        setSelectedPart(part.id);
      }
    }

    renderer.domElement.addEventListener(
      "pointerdown",
      onPointerDown,
    );

    renderer.domElement.addEventListener(
      "pointerup",
      onPointerUp,
    );

    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(
        viewerContainer.clientWidth,
        1,
      );

      const height = Math.max(
        viewerContainer.clientHeight,
        1,
      );

      camera.aspect = width / height;
      renderer.setSize(width, height, false);

      applyEnvironmentProjection(
        currentEnvironmentPlacement,
      );
    });

    resizeObserver.observe(viewerContainer);

    function render(now = performance.now()) {
      if (cameraTransition) {
        const progress = Math.min(
          (now - cameraTransition.startedAt) /
            cameraTransition.duration,
          1,
        );

        const eased =
          1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(
          cameraTransition.fromPosition,
          cameraTransition.position,
          eased,
        );

        controls.target.lerpVectors(
          cameraTransition.fromTarget,
          cameraTransition.target,
          eased,
        );

        if (progress >= 1) {
          cameraTransition = null;
        }
      }

      for (const mesh of meshes.values()) {
        const target =
          mesh.userData
            .targetPosition as THREE.Vector3 | undefined;

        if (!target) continue;

        if (prefersReducedMotion()) {
          mesh.position.copy(target);
        } else {
          mesh.position.lerp(target, 0.1);

          if (
            mesh.position.distanceToSquared(target) <
            0.0000001
          ) {
            mesh.position.copy(target);
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);

      animationFrame =
        window.requestAnimationFrame(render);
    }

    render();

    return () => {
      disposed = true;
      actionsRef.current = null;

      window.cancelAnimationFrame(animationFrame);
      clearExplodeTimers();
      resizeObserver.disconnect();

      renderer.domElement.removeEventListener(
        "pointerdown",
        onPointerDown,
      );

      renderer.domElement.removeEventListener(
        "pointerup",
        onPointerUp,
      );

      controls.removeEventListener(
        "start",
        cancelCameraTransition,
      );

      controls.dispose();

      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();

        if (mesh.material) {
          disposeMaterial(mesh.material);
        }
      }

      for (const promise of texturePromises.values()) {
        promise
          .then((texture) => texture.dispose())
          .catch(() => undefined);
      }

      for (const url of downloadUrls) {
        URL.revokeObjectURL(url);
      }

      for (const timer of feedbackTimers) {
        window.clearTimeout(timer);
      }

      floorGeometry.dispose();
      floorMaterial.dispose();
      shadowMaterial.dispose();
      environmentTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [selectedProduct, exposure]);

  function chooseProduct(
    productId: AtelierProductId,
  ) {
    if (productId === selectedProductId) return;

    const nextProduct = atelierProducts[productId];
    const nextMaterials =
      createInitialMaterials(nextProduct);

    materialsRef.current = nextMaterials;
    textureScaleRef.current = 1;

    setStatus("loading");
    setSelectedProductId(productId);
    setSelectedPart(nextProduct.parts[0].id);
    setPartMaterials(nextMaterials);
    setTextureScale(1);
    setExploded(false);
    setAutoRotate(false);
    setActiveView("perspective");
    setExportMessage("");

    actionsRef.current?.setAutoRotate(false);
  }

  function openEnvironmentPicker() {
    if (
      status !== "ready" ||
      environmentStatus === "loading"
    ) {
      return;
    }

    setEnvironmentError(null);

    if (environmentInputRef.current) {
      environmentInputRef.current.value = "";
      environmentInputRef.current.click();
    }
  }

  function handleEnvironmentFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!environmentFileTypes.includes(file.type)) {
      setEnvironmentError(
        "Formato non supportato. Usa una foto JPG, PNG o WebP.",
      );
      setEnvironmentStatus(
        environmentUrlRef.current ? "ready" : "error",
      );
      return;
    }

    if (
      file.size === 0 ||
      file.size > environmentFileMaxBytes
    ) {
      setEnvironmentError(
        file.size === 0
          ? "La fotografia è vuota."
          : "La foto supera 20 MB.",
      );
      return;
    }

    const requestId =
      environmentLoadRequestRef.current + 1;

    environmentLoadRequestRef.current = requestId;

    const candidateUrl =
      URL.createObjectURL(file);

    environmentPendingUrlRef.current =
      candidateUrl;

    setEnvironmentStatus("loading");
    setEnvironmentError(null);

    const candidate = new Image();

    candidate.onload = () => {
      if (
        environmentLoadRequestRef.current !== requestId
      ) {
        URL.revokeObjectURL(candidateUrl);
        return;
      }

      if (
        candidate.naturalWidth *
          candidate.naturalHeight >
        environmentImageMaxPixels
      ) {
        URL.revokeObjectURL(candidateUrl);
        setEnvironmentError(
          "La foto è troppo grande per questo dispositivo.",
        );
        setEnvironmentStatus("error");
        return;
      }

      const previousUrl =
        environmentUrlRef.current;

      environmentPendingUrlRef.current = null;
      environmentUrlRef.current = candidateUrl;

      setEnvironmentUrl(candidateUrl);
      setEnvironmentStatus("ready");

      actionsRef.current?.setEnvironmentEnabled(
        true,
      );

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
    };

    candidate.onerror = () => {
      URL.revokeObjectURL(candidateUrl);
      setEnvironmentError(
        "Non riesco a leggere questa foto.",
      );
      setEnvironmentStatus("error");
    };

    candidate.src = candidateUrl;
  }

  function changeEnvironmentPlacement(
    property: keyof EnvironmentPlacement,
    value: number,
  ) {
    const next = {
      ...environmentPlacementRef.current,
      [property]: value,
    };

    environmentPlacementRef.current = next;
    setEnvironmentPlacement(next);

    actionsRef.current?.updateEnvironmentPlacement(
      next,
    );
  }

  function removeEnvironment() {
    if (environmentUrlRef.current) {
      URL.revokeObjectURL(environmentUrlRef.current);
    }

    environmentUrlRef.current = null;
    setEnvironmentUrl(null);
    setEnvironmentStatus("idle");
    setEnvironmentError(null);

    actionsRef.current?.setEnvironmentEnabled(
      false,
    );
  }

  function choosePart(
    partId: AtelierPartId,
    moveFocus = false,
  ) {
    setSelectedPart(partId);

    if (moveFocus) {
      window.requestAnimationFrame(() =>
        partButtons.current[partId]?.focus(),
      );
    }
  }

  function handlePartKeys(
    event: KeyboardEvent<HTMLButtonElement>,
    partId: AtelierPartId,
  ) {
    const ids = selectedProduct.parts.map(
      (part) => part.id,
    );

    const index = ids.indexOf(partId);
    let nextIndex: number | null = null;

    if (
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      nextIndex = (index + 1) % ids.length;
    }

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp"
    ) {
      nextIndex =
        (index - 1 + ids.length) % ids.length;
    }

    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") {
      nextIndex = ids.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    choosePart(ids[nextIndex], true);
  }

  function chooseMaterial(
    material: StoneMaterial,
  ) {
    if (
      !material.allowedOn.includes(
        selectedPartDefinition.role,
      )
    ) {
      return;
    }

    const next = {
      ...partMaterials,
      [selectedPart]: material.id,
    };

    materialsRef.current = next;
    setPartMaterials(next);

    void actionsRef.current?.applyMaterial(
      selectedPart,
      material.id,
    );
  }

  function applyEverywhere() {
    if (!canApplyEverywhere) return;

    const next = Object.fromEntries(
      selectedProduct.parts.map((part) => [
        part.id,
        selectedMaterial.id,
      ]),
    ) as PartMaterials;

    materialsRef.current = next;
    setPartMaterials(next);

    for (const part of selectedProduct.parts) {
      void actionsRef.current?.applyMaterial(
        part.id,
        selectedMaterial.id,
      );
    }
  }

  function resetView() {
    setExploded(false);
    setAutoRotate(false);
    setActiveView("perspective");

    actionsRef.current?.setExploded(false);
    actionsRef.current?.setAutoRotate(false);
    actionsRef.current?.setView("perspective");
  }

  const visibleProducts = Object.entries(
    atelierProducts,
  ) as [AtelierProductId, AtelierProduct][];

  return (
    <section
      className="atelier-configurator"
      aria-labelledby="configurator-title"
    >
      <div className="viewer-panel">
        <div className="viewer-meta">
          <span>
            Modello Rev. {selectedProduct.revision}
          </span>
          <span>{selectedProduct.dimensions}</span>
        </div>

        <div
          className={`viewer-canvas ${
            environmentUrl
              ? "has-environment"
              : ""
          }`}
        >
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

          <div
            className="viewer-webgl-layer"
            ref={viewerRef}
          />

          {status !== "ready" && (
            <div
              className={`viewer-loading ${
                status === "error"
                  ? "has-error"
                  : ""
              }`}
              role="status"
            >
              <span
                className="loading-line"
                aria-hidden="true"
              />

              <strong>
                {status === "error"
                  ? "Modello non disponibile"
                  : "Preparo la materia"}
              </strong>

              <p>
                {status === "error"
                  ? "Controlla il percorso del modello e i nomi delle mesh nella console."
                  : `Caricamento della geometria ${selectedProduct.name}…`}
              </p>
            </div>
          )}

          {exportMessage && (
            <p
              className="viewer-feedback"
              role="status"
              aria-live="polite"
            >
              {exportMessage}
            </p>
          )}
        </div>

        <div className="viewer-toolbar">
          <div className="view-buttons">
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
                className={
                  activeView === id
                    ? "is-active"
                    : ""
                }
                disabled={status !== "ready"}
                onClick={() => {
                  setActiveView(id);
                  actionsRef.current?.setView(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="viewer-actions">
            <button
              type="button"
              disabled={status !== "ready"}
              onClick={() => {
                const next = !exploded;
                setExploded(next);
                actionsRef.current?.setExploded(
                  next,
                );
              }}
            >
              Esploso
            </button>

            <button
              type="button"
              disabled={status !== "ready"}
              onClick={() => {
                const next = !autoRotate;
                setAutoRotate(next);

                actionsRef.current?.setAutoRotate(
                  next,
                );
              }}
            >
              Rotazione
            </button>

            <input
              ref={environmentInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleEnvironmentFile}
            />

            <button
              type="button"
              disabled={status !== "ready"}
              onClick={openEnvironmentPicker}
            >
              Ambiente
            </button>

            <button
              type="button"
              disabled={status !== "ready"}
              onClick={resetView}
            >
              Reimposta vista
            </button>

            <button
              type="button"
              disabled={status !== "ready"}
              onClick={() =>
                actionsRef.current?.saveImage()
              }
            >
              Salva immagine
            </button>
          </div>
        </div>
      </div>

      <aside className="configuration-panel">
        <div className="configuration-heading">
          <p className="eyebrow">
            02 — Componi il tuo{" "}
            {selectedProduct.shortName}
          </p>

          <h2 id="configurator-title">
            Materia,
            <br />
            elemento per elemento
          </h2>

          <p>
            Seleziona il tavolo, una parte e la
            pietra desiderata.
          </p>
        </div>

        <div className="control-section">
          <div className="control-title">
            <span>01</span>
            <strong>Modello</strong>
          </div>

          <div
            className="part-tabs"
            role="radiogroup"
            aria-label="Modello da configurare"
          >
            {visibleProducts.map(
              ([productId, product]) => (
                <button
                  key={productId}
                  type="button"
                  role="radio"
                  aria-checked={
                    selectedProductId === productId
                  }
                  className={
                    selectedProductId === productId
                      ? "is-active"
                      : ""
                  }
                  disabled={status === "loading"}
                  onClick={() =>
                    chooseProduct(productId)
                  }
                >
                  <span>{product.shortName}</span>
                  <small>
                    {product.collection}
                  </small>
                </button>
              ),
            )}
          </div>
        </div>

        <div className="control-section">
          <div className="control-title">
            <span>02</span>
            <strong>Componente</strong>
          </div>

          <div
            className="part-tabs"
            role="radiogroup"
            aria-label="Componente da configurare"
          >
            {selectedProduct.parts.map((part) => (
              <button
                key={part.id}
                ref={(element) => {
                  partButtons.current[part.id] =
                    element;
                }}
                type="button"
                role="radio"
                aria-checked={
                  selectedPart === part.id
                }
                tabIndex={
                  selectedPart === part.id ? 0 : -1
                }
                className={
                  selectedPart === part.id
                    ? "is-active"
                    : ""
                }
                onKeyDown={(event) =>
                  handlePartKeys(event, part.id)
                }
                onClick={() =>
                  choosePart(part.id)
                }
              >
                <span>{part.shortLabel}</span>
                <small>
                  {part.role === "plane"
                    ? "Piano"
                    : "Gamba"}
                </small>
              </button>
            ))}
          </div>

          <p className="part-specification">
            {selectedPartDefinition.specification}
          </p>
        </div>

        <div className="control-section materials-section">
          <div className="control-title">
            <span>03</span>
            <strong>Pietra</strong>
          </div>

          <div className="current-material">
            <span
              style={{
                backgroundImage: `url(${selectedMaterial.texture})`,
              }}
              aria-hidden="true"
            />

            <div>
              <small>
                {selectedPartDefinition.label}
              </small>
              <strong>
                {selectedMaterial.name}
              </strong>
            </div>
          </div>

          <div className="material-grid">
            {stoneMaterials.map((material) => {
              const allowed =
                material.allowedOn.includes(
                  selectedPartDefinition.role,
                );

              const active =
                selectedMaterial.id === material.id;

              return (
                <button
                  key={material.id}
                  type="button"
                  className={
                    active ? "is-active" : ""
                  }
                  disabled={!allowed}
                  aria-pressed={active}
                  onClick={() =>
                    chooseMaterial(material)
                  }
                >
                  <span className="material-thumb">
                    <img
                      src={material.texture}
                      alt=""
                      loading="lazy"
                    />
                  </span>

                  <span className="material-name">
                    {material.name}
                  </span>

                  {!allowed && (
                    <small>Solo piani</small>
                  )}
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
            <span>
              {canApplyEverywhere
                ? "Applica a tutti gli elementi"
                : "Disponibile solo per i piani"}
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="control-section rendering-controls">
          <div className="control-title">
            <span>04</span>
            <strong>Resa indicativa</strong>
          </div>

          <label>
            <span>Scala venatura</span>
            <output>
              {Math.round(textureScale * 100)}%
            </output>

            <input
              type="range"
              min="0.55"
              max="1.8"
              step="0.05"
              value={textureScale}
              onChange={(event) => {
                const value = Number(
                  event.target.value,
                );

                textureScaleRef.current = value;
                setTextureScale(value);

                actionsRef.current?.updateTextureScale(
                  value,
                );
              }}
            />
          </label>

          <label>
            <span>Luce ambiente</span>
            <output>
              {Math.round(exposure * 100)}%
            </output>

            <input
              type="range"
              min="0.65"
              max="1.35"
              step="0.05"
              value={exposure}
              onChange={(event) => {
                const value = Number(
                  event.target.value,
                );

                setExposure(value);

                actionsRef.current?.setExposure(
                  value,
                );
              }}
            />
          </label>
        </div>

        {environmentUrl && (
          <div className="control-section environment-controls">
            <div className="control-title">
              <span>05</span>
              <strong>Ambiente reale</strong>
            </div>

            {(
              [
                ["scale", "Dimensione tavolo", 0.65, 1.45, 0.01],
                ["x", "Posizione orizzontale", -30, 30, 1],
                ["y", "Posizione verticale", -25, 25, 1],
                ["shadow", "Intensità ombra", 0, 0.45, 0.01],
              ] as const
            ).map(
              ([property, label, min, max, step]) => (
                <label key={property}>
                  <span>{label}</span>

                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={
                      environmentPlacement[property]
                    }
                    onChange={(event) =>
                      changeEnvironmentPlacement(
                        property,
                        Number(event.target.value),
                      )
                    }
                  />
                </label>
              ),
            )}

            <button
              type="button"
              onClick={removeEnvironment}
            >
              Rimuovi foto
            </button>
          </div>
        )}

        {environmentError && (
          <p role="alert">{environmentError}</p>
        )}
      </aside>
    </section>
  );
}
