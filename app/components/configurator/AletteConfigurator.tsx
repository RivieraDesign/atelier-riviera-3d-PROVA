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
  getAtelierProduct,
  isAtelierProductId,
  stoneMaterials,
  type AtelierPartId,
  type AtelierProduct,
  type AtelierProductId,
  type ProductPart,
  type StoneMaterial,
} from "../../data/atelier-catalog";

type ViewName =
  | "perspective"
  | "front"
  | "side"
  | "top";

type LoadStatus =
  | "loading"
  | "ready"
  | "error";

type EnvironmentStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

type PartMaterials = Partial<
  Record<AtelierPartId, string>
>;

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
  updateEnvironmentPlacement: (
    placement: EnvironmentPlacement,
  ) => void;
  saveImage: () => void;
};

const DEFAULT_PRODUCT_ID: AtelierProductId =
  "alette-coffee";

const DEFAULT_MATERIAL_ID = "bianco-carrara";

const TARGET_MODEL_WIDTH = 1.25;

const initialEnvironmentPlacement: EnvironmentPlacement =
  {
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

const environmentFileMaxBytes =
  20 * 1024 * 1024;

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

function getRequestedProductId(): AtelierProductId {
  if (typeof window === "undefined") {
    return DEFAULT_PRODUCT_ID;
  }

  const requestedProductId =
    new URLSearchParams(
      window.location.search,
    ).get("model");

  if (isAtelierProductId(requestedProductId)) {
    return requestedProductId;
  }

  const storedProductId =
    window.localStorage.getItem(
      "atelier-riviera-model",
    );

  if (isAtelierProductId(storedProductId)) {
    return storedProductId;
  }

  return DEFAULT_PRODUCT_ID;
}

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
    const mapped =
      item as THREE.MeshStandardMaterial;

    mapped.map?.dispose();
    item.dispose();
  }
}

function prepareGeometry(
  mesh: THREE.Mesh,
  part: ProductPart,
) {
  const geometry = mesh.geometry.clone();
  const position =
    geometry.getAttribute("position");

  const uv = new Float32Array(
    position.count * 2,
  );

  const bounds = new THREE.Box3().setFromBufferAttribute(
    position as THREE.BufferAttribute,
  );

  const size = bounds.getSize(new THREE.Vector3());

  const safeX = Math.max(size.x, 0.00001);
  const safeY = Math.max(size.y, 0.00001);
  const safeZ = Math.max(size.z, 0.00001);

  for (
    let index = 0;
    index < position.count;
    index += 1
  ) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);

    if (part.role === "plane") {
      uv[index * 2] =
        (x - bounds.min.x) / safeX;

      uv[index * 2 + 1] =
        (z - bounds.min.z) / safeZ;
    } else if (part.id === "leg-a") {
      uv[index * 2] =
        (x - bounds.min.x) / safeX;

      uv[index * 2 + 1] =
        (y - bounds.min.y) / safeY;
    } else {
      uv[index * 2] =
        (z - bounds.min.z) / safeZ;

      uv[index * 2 + 1] =
        (y - bounds.min.y) / safeY;
    }
  }

  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(uv, 2),
  );

  geometry.computeVertexNormals();
  mesh.geometry = geometry;
}

function normalizeModel(
  model: THREE.Object3D,
): number {
  model.updateMatrixWorld(true);

  const initialBounds =
    new THREE.Box3().setFromObject(model);

  const initialSize =
    initialBounds.getSize(new THREE.Vector3());

  const horizontalSize = Math.max(
    initialSize.x,
    initialSize.z,
  );

  if (
    !Number.isFinite(horizontalSize) ||
    horizontalSize <= 0
  ) {
    throw new Error(
      "Il modello non contiene geometrie misurabili.",
    );
  }

  const normalizationScale =
    TARGET_MODEL_WIDTH / horizontalSize;

  model.scale.multiplyScalar(normalizationScale);
  model.updateMatrixWorld(true);

  const normalizedBounds =
    new THREE.Box3().setFromObject(model);

  const normalizedCenter =
    normalizedBounds.getCenter(
      new THREE.Vector3(),
    );

  model.position.x -= normalizedCenter.x;
  model.position.z -= normalizedCenter.z;
  model.position.y -= normalizedBounds.min.y;

  model.updateMatrixWorld(true);

  return normalizationScale;
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

  const sourceX =
    (image.naturalWidth - sourceWidth) / 2;

  const sourceY =
    (image.naturalHeight - sourceHeight) / 2;

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
  const initialProduct =
    atelierProducts[DEFAULT_PRODUCT_ID];

  const viewerRef =
    useRef<HTMLDivElement>(null);

  const actionsRef =
    useRef<ViewerActions | null>(null);

  const materialsRef = useRef<PartMaterials>(
    createInitialMaterials(initialProduct),
  );

  const textureScaleRef = useRef(1);
  const exposureRef = useRef(1);

  const partButtons = useRef<
    Partial<
      Record<
        AtelierPartId,
        HTMLButtonElement | null
      >
    >
  >({});

  const environmentInputRef =
    useRef<HTMLInputElement>(null);

  const environmentImageRef =
    useRef<HTMLImageElement>(null);

  const environmentUrlRef =
    useRef<string | null>(null);

  const environmentPendingUrlRef =
    useRef<string | null>(null);

  const environmentLoadRequestRef = useRef(0);

  const environmentPlacementRef =
    useRef<EnvironmentPlacement>(
      initialEnvironmentPlacement,
    );

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState<AtelierProductId>(
    DEFAULT_PRODUCT_ID,
  );

  const selectedProduct =
    atelierProducts[selectedProductId];

  const [status, setStatus] =
    useState<LoadStatus>("loading");

  const [selectedPart, setSelectedPart] =
    useState<AtelierPartId>("top");

  const [
    partMaterials,
    setPartMaterials,
  ] = useState<PartMaterials>(
    createInitialMaterials(initialProduct),
  );

  const [textureScale, setTextureScale] =
    useState(1);

  const [exposure, setExposure] = useState(1);

  const [exploded, setExploded] =
    useState(false);

  const [autoRotate, setAutoRotate] =
    useState(false);

  const [activeView, setActiveView] =
    useState<ViewName>("perspective");

  const [
    environmentUrl,
    setEnvironmentUrl,
  ] = useState<string | null>(null);

  const [
    environmentStatus,
    setEnvironmentStatus,
  ] = useState<EnvironmentStatus>("idle");

  const [
    environmentError,
    setEnvironmentError,
  ] = useState<string | null>(null);

  const [
    environmentPlacement,
    setEnvironmentPlacement,
  ] = useState<EnvironmentPlacement>(
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
        (material) =>
          material.id === materialId,
      ) ?? stoneMaterials[0]
    );
  }, [partMaterials, selectedPart]);

  const canApplyEverywhere =
    selectedProduct.parts.every((part) =>
      selectedMaterial.allowedOn.includes(
        part.role,
      ),
    );

  useEffect(() => {
    const requestedProductId =
      getRequestedProductId();

    const requestedProduct =
      getAtelierProduct(requestedProductId);

    const requestedMaterials =
      createInitialMaterials(requestedProduct);

    window.localStorage.setItem(
      "atelier-riviera-model",
      requestedProductId,
    );

    materialsRef.current =
      requestedMaterials;

    setSelectedProductId(
      requestedProductId,
    );

    setSelectedPart(
      requestedProduct.parts[0].id,
    );

    setPartMaterials(requestedMaterials);
    setStatus("loading");
  }, []);

  useEffect(() => {
    materialsRef.current = partMaterials;
  }, [partMaterials]);

  useEffect(() => {
    textureScaleRef.current = textureScale;
  }, [textureScale]);

  useEffect(() => {
    exposureRef.current = exposure;
  }, [exposure]);

  useEffect(
    () => () => {
      environmentLoadRequestRef.current += 1;

      if (
        environmentPendingUrlRef.current
      ) {
        URL.revokeObjectURL(
          environmentPendingUrlRef.current,
        );
      }

      if (environmentUrlRef.current) {
        URL.revokeObjectURL(
          environmentUrlRef.current,
        );
      }

      environmentPendingUrlRef.current =
        null;

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
    let environmentEnabled =
      Boolean(environmentUrlRef.current);

    let currentEnvironmentPlacement =
      environmentPlacementRef.current;

    let activeCameraView: ViewName =
      "perspective";

    let cameraBeforeExplode:
      | CameraPose
      | null = null;

    let cameraTransition:
      | CameraTransition
      | null = null;

    let modelTarget =
      new THREE.Vector3(0, 0.18, 0);

    let modelCameraDistance = 1.75;
    let localExplodeMultiplier = 1;

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
      queueMicrotask(() =>
        setStatus("error"),
      );

      return;
    }

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2),
    );

    renderer.setSize(
      Math.max(
        viewerContainer.clientWidth,
        1,
      ),
      Math.max(
        viewerContainer.clientHeight,
        1,
      ),
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure =
      exposureRef.current;

    renderer.setClearColor(0x000000, 0);

    renderer.shadowMap.enabled = true;

    renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;

    renderer.domElement.setAttribute(
      "role",
      "img",
    );

    renderer.domElement.setAttribute(
      "aria-label",
      `Modello tridimensionale interattivo di ${selectedProduct.name}.`,
    );

    viewerContainer.appendChild(
      renderer.domElement,
    );

    const scene = new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        35,
        Math.max(
          viewerContainer.clientWidth,
          1,
        ) /
          Math.max(
            viewerContainer.clientHeight,
            1,
          ),
        0.01,
        50,
      );

    const controls = new OrbitControls(
      camera,
      renderer.domElement,
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.5;
    controls.maxDistance = 10;
    controls.maxPolarAngle =
      Math.PI * 0.495;
    controls.autoRotateSpeed = 0.7;

    const prefersReducedMotion = () =>
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    function assembledCameraPose(
      view: ViewName,
    ): CameraPose {
      const target = modelTarget.clone();
      const distance = modelCameraDistance;

      if (view === "front") {
        return {
          position: new THREE.Vector3(
            0,
            target.y + distance * 0.1,
            distance,
          ),
          target,
        };
      }

      if (view === "side") {
        return {
          position: new THREE.Vector3(
            distance,
            target.y + distance * 0.1,
            0,
          ),
          target,
        };
      }

      if (view === "top") {
        return {
          position: new THREE.Vector3(
            0.001,
            target.y + distance * 1.2,
            0.001,
          ),
          target,
        };
      }

      return {
        position: new THREE.Vector3(
          distance * 0.78,
          target.y + distance * 0.42,
          distance * 0.78,
        ),
        target,
      };
    }

    function explodedCameraPose(
      view: ViewName,
    ): CameraPose {
      const target = modelTarget
        .clone()
        .add(
          new THREE.Vector3(
            0,
            0.16,
            0,
          ),
        );

      const distance =
        modelCameraDistance * 1.3;

      if (view === "front") {
        return {
          position: new THREE.Vector3(
            0,
            target.y + distance * 0.15,
            distance,
          ),
          target,
        };
      }

      if (view === "side") {
        return {
          position: new THREE.Vector3(
            distance,
            target.y + distance * 0.15,
            0,
          ),
          target,
        };
      }

      if (view === "top") {
        return {
          position: new THREE.Vector3(
            0.001,
            target.y + distance * 1.15,
            0.001,
          ),
          target,
        };
      }

      return {
        position: new THREE.Vector3(
          distance * 0.72,
          target.y + distance * 0.46,
          distance * 0.72,
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

        camera.position.copy(
          pose.position,
        );

        controls.target.copy(pose.target);
        controls.update();

        return;
      }

      cameraTransition = {
        fromPosition:
          camera.position.clone(),
        fromTarget:
          controls.target.clone(),
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

    const pmrem =
      new THREE.PMREMGenerator(renderer);

    const roomEnvironment =
      new RoomEnvironment();

    const environmentTarget =
      pmrem.fromScene(
        roomEnvironment,
        0.04,
      );

    scene.environment =
      environmentTarget.texture;

    roomEnvironment.dispose();
    pmrem.dispose();

    const hemisphere =
      new THREE.HemisphereLight(
        0xffffff,
        0x7d756b,
        1.15,
      );

    scene.add(hemisphere);

    const keyLight =
      new THREE.DirectionalLight(
        0xffffff,
        2.4,
      );

    keyLight.position.set(
      2.5,
      4.2,
      2.2,
    );

    keyLight.castShadow = true;

    keyLight.shadow.mapSize.set(
      1024,
      1024,
    );

    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 10;

    scene.add(keyLight);

    const fillLight =
      new THREE.DirectionalLight(
        0xfff1df,
        0.75,
      );

    fillLight.position.set(
      -2.5,
      1.8,
      -1.5,
    );

    scene.add(fillLight);

    const floorGeometry =
      new THREE.CircleGeometry(3.2, 96);

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

    const shadowMaterial =
      new THREE.ShadowMaterial({
        color: 0x000000,
        opacity:
          currentEnvironmentPlacement.shadow,
        transparent: true,
        depthWrite: false,
      });

    const shadowFloor = new THREE.Mesh(
      floorGeometry,
      shadowMaterial,
    );

    shadowFloor.rotation.x =
      -Math.PI / 2;

    shadowFloor.position.y = -0.001;
    shadowFloor.receiveShadow = true;

    shadowFloor.visible =
      environmentEnabled;

    floor.visible = !environmentEnabled;

    scene.add(shadowFloor);

    const textureLoader =
      new THREE.TextureLoader();

    function getBaseTexture(
      material: StoneMaterial,
    ) {
      let promise = texturePromises.get(
        material.id,
      );

      if (!promise) {
        promise = textureLoader
          .loadAsync(material.texture)
          .then((texture) => {
            texture.colorSpace =
              THREE.SRGBColorSpace;

            texture.wrapS =
              THREE.RepeatWrapping;

            texture.wrapT =
              THREE.RepeatWrapping;

            texture.anisotropy =
              Math.min(
                renderer.capabilities.getMaxAnisotropy(),
                12,
              );

            return texture;
          });

        texturePromises.set(
          material.id,
          promise,
        );
      }

      return promise;
    }

    function updateMapScale(
      texture: THREE.Texture,
      partId: AtelierPartId,
      scale: number,
    ) {
      const image = texture.image as
        | {
            width?: number;
            height?: number;
          }
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
        ...partTextureOffsets[partId],
      );

      texture.needsUpdate = true;
    }

    async function applyMaterial(
      partId: AtelierPartId,
      materialId: string,
    ) {
      const mesh = meshes.get(partId);

      const part =
        selectedProduct.parts.find(
          (entry) =>
            entry.id === partId,
        );

      const material =
        stoneMaterials.find(
          (entry) =>
            entry.id === materialId,
        );

      if (
        !mesh ||
        !part ||
        !material ||
        !material.allowedOn.includes(
          part.role,
        )
      ) {
        return;
      }

      const requestId =
        (materialRequest.get(partId) ??
          0) + 1;

      materialRequest.set(
        partId,
        requestId,
      );

      try {
        const baseTexture =
          await getBaseTexture(material);

        if (
          disposed ||
          materialRequest.get(partId) !==
            requestId
        ) {
          return;
        }

        const texture =
          baseTexture.clone();

        texture.wrapS =
          THREE.RepeatWrapping;

        texture.wrapT =
          THREE.RepeatWrapping;

        updateMapScale(
          texture,
          partId,
          textureScaleRef.current,
        );

        const nextMaterial =
          new THREE.MeshPhysicalMaterial({
            map: texture,
            color: 0xffffff,
            roughness:
              material.roughness,
            metalness: 0,
            clearcoat:
              part.role === "plane"
                ? 0.08
                : 0.04,
            clearcoatRoughness: 0.55,
            envMapIntensity: 0.65,
            side: THREE.DoubleSide,
          });

        if (mesh.material) {
          disposeMaterial(
            mesh.material,
          );
        }

        mesh.material = nextMaterial;
      } catch (error) {
        console.error(
          `[Atelier] Materiale non disponibile per ${partId}:`,
          error,
        );

        if (!disposed) {
          queueMicrotask(() =>
            setStatus("error"),
          );
        }
      }
    }

    function updateTextureScaleValue(
      scale: number,
    ) {
      for (const [
        partId,
        mesh,
      ] of meshes) {
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
      placement =
        currentEnvironmentPlacement,
    ) {
      currentEnvironmentPlacement =
        placement;

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
          (-placement.x / 100) *
            width,
          (placement.y / 100) *
            height,
          width,
          height,
        );
      } else {
        camera.clearViewOffset();
      }

      camera.updateProjectionMatrix();

      floor.visible =
        !environmentEnabled;

      shadowFloor.visible =
        environmentEnabled;

      shadowMaterial.opacity =
        placement.shadow;

      shadowMaterial.needsUpdate =
        true;
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

      const part =
        selectedProduct.parts.find(
          (entry) =>
            entry.id === partId,
        );

      if (!mesh || !part) return;

      const base =
        mesh.userData
          .basePosition as THREE.Vector3;

      const worldOffset =
        new THREE.Vector3(
          ...part.explodeOffset,
        );

      const localOffset =
        worldOffset.multiplyScalar(
          localExplodeMultiplier,
        );

      const target = value
        ? base.clone().add(localOffset)
        : base.clone();

      mesh.userData.targetPosition =
        target;

      if (prefersReducedMotion()) {
        mesh.position.copy(target);
      }
    }

    function setExplodedView(
      value: boolean,
    ) {
      clearExplodeTimers();

      if (
        value &&
        !explodedViewActive
      ) {
        cameraBeforeExplode = {
          position:
            camera.position.clone(),
          target:
            controls.target.clone(),
        };
      }

      explodedViewActive = value;

      const orderedParts = value
        ? selectedProduct.parts
        : [...selectedProduct.parts]
            .reverse();

      orderedParts.forEach(
        (part, index) => {
          const run = () =>
            setPartExploded(
              part.id,
              value,
            );

          if (prefersReducedMotion()) {
            run();
            return;
          }

          const timer =
            window.setTimeout(() => {
              explodeTimers.delete(
                timer,
              );

              run();
            }, index * 140);

          explodeTimers.add(timer);
        },
      );

      if (value) {
        moveCamera(
          explodedCameraPose(
            activeCameraView,
          ),
        );
      } else {
        moveCamera(
          cameraBeforeExplode ??
            assembledCameraPose(
              activeCameraView,
            ),
        );

        cameraBeforeExplode = null;
      }
    }

    function setView(view: ViewName) {
      activeCameraView = view;

      const assembledPose =
        assembledCameraPose(view);

      if (explodedViewActive) {
        cameraBeforeExplode =
          assembledPose;
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

      setExportMessage(
        "Preparo l’immagine…",
      );

      renderer.render(scene, camera);

      const output =
        document.createElement("canvas");

      output.width =
        renderer.domElement.width;

      output.height =
        renderer.domElement.height;

      const context =
        output.getContext("2d");

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

        const link =
          document.createElement("a");

        link.href = downloadUrl;

        link.download =
          environmentEnabled
            ? `riviera-design-${selectedProduct.id}-ambiente-${Date.now()}.png`
            : `riviera-design-${selectedProduct.id}-${Date.now()}.png`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setExportMessage(
          "Immagine salvata sul dispositivo.",
        );

        const feedbackTimer =
          window.setTimeout(() => {
            feedbackTimers.delete(
              feedbackTimer,
            );

            if (!disposed) {
              setExportMessage("");
            }
          }, 3200);

        feedbackTimers.add(
          feedbackTimer,
        );

        window.setTimeout(() => {
          URL.revokeObjectURL(
            downloadUrl,
          );

          downloadUrls.delete(
            downloadUrl,
          );
        }, 0);
      }, "image/png");
    }

    actionsRef.current = {
      applyMaterial,

      updateTextureScale:
        updateTextureScaleValue,

      setExposure: (value) => {
        renderer.toneMappingExposure =
          value;
      },

      setExploded: setExplodedView,

      setAutoRotate: (value) => {
        controls.autoRotate =
          value &&
          !prefersReducedMotion();
      },

      setView,

      setEnvironmentEnabled: (
        value,
      ) => {
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

        const availableMeshes:
          string[] = [];

        gltf.scene.traverse(
          (object) => {
            if (
              object instanceof THREE.Mesh
            ) {
              availableMeshes.push(
                object.name,
              );
            }
          },
        );

        console.info(
          `[Atelier] Mesh di ${selectedProduct.model}:`,
          availableMeshes,
        );

        for (
          const part of
          selectedProduct.parts
        ) {
          const object =
            gltf.scene.getObjectByName(
              part.meshName,
            );

          if (
            !(
              object instanceof
              THREE.Mesh
            )
          ) {
            throw new Error(
              `Componente "${part.meshName}" non trovato. Mesh disponibili: ${availableMeshes.join(", ")}`,
            );
          }

          prepareGeometry(
            object,
            part,
          );

          object.castShadow = true;
          object.receiveShadow = true;

          object.userData.basePosition =
            object.position.clone();

          object.userData.targetPosition =
            object.position.clone();

          meshes.set(part.id, object);
        }

        const normalizationScale =
          normalizeModel(gltf.scene);

        localExplodeMultiplier =
          1 /
          Math.max(
            normalizationScale,
            0.000001,
          );

        scene.add(gltf.scene);

        const modelBounds =
          new THREE.Box3().setFromObject(
            gltf.scene,
          );

        const modelSize =
          modelBounds.getSize(
            new THREE.Vector3(),
          );

        modelTarget =
          new THREE.Vector3(
            0,
            Math.max(
              modelSize.y * 0.45,
              0.12,
            ),
            0,
          );

        modelCameraDistance =
          Math.max(
            modelSize.x,
            modelSize.y,
            modelSize.z,
          ) * 1.65;

        controls.minDistance =
          modelCameraDistance * 0.45;

        controls.maxDistance =
          modelCameraDistance * 5;

        const initialPose =
          assembledCameraPose(
            "perspective",
          );

        camera.position.copy(
          initialPose.position,
        );

        controls.target.copy(
          initialPose.target,
        );

        controls.update();

        await Promise.all(
          selectedProduct.parts.map(
            (part) =>
              applyMaterial(
                part.id,
                materialsRef.current[
                  part.id
                ] ??
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

    let pointerStart = {
      x: 0,
      y: 0,
    };

    function onPointerDown(
      event: PointerEvent,
    ) {
      pointerStart = {
        x: event.clientX,
        y: event.clientY,
      };
    }

    function onPointerUp(
      event: PointerEvent,
    ) {
      if (
        Math.hypot(
          event.clientX -
            pointerStart.x,
          event.clientY -
            pointerStart.y,
        ) > 5
      ) {
        return;
      }

      const rect =
        renderer.domElement.getBoundingClientRect();

      pointer.x =
        ((event.clientX -
          rect.left) /
          rect.width) *
          2 -
        1;

      pointer.y =
        -((event.clientY -
          rect.top) /
          rect.height) *
          2 +
        1;

      raycaster.setFromCamera(
        pointer,
        camera,
      );

      const hit =
        raycaster.intersectObjects(
          [...meshes.values()],
          false,
        )[0];

      if (!hit) return;

      const part =
        selectedProduct.parts.find(
          (entry) =>
            entry.meshName ===
            hit.object.name,
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

    const resizeObserver =
      new ResizeObserver(() => {
        const width = Math.max(
          viewerContainer.clientWidth,
          1,
        );

        const height = Math.max(
          viewerContainer.clientHeight,
          1,
        );

        camera.aspect =
          width / height;

        renderer.setSize(
          width,
          height,
          false,
        );

        applyEnvironmentProjection(
          currentEnvironmentPlacement,
        );
      });

    resizeObserver.observe(
      viewerContainer,
    );

    function render(
      now = performance.now(),
    ) {
      if (cameraTransition) {
        const progress = Math.min(
          (now -
            cameraTransition.startedAt) /
            cameraTransition.duration,
          1,
        );

        const eased =
          1 -
          Math.pow(
            1 - progress,
            3,
          );

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
            .targetPosition as
            | THREE.Vector3
            | undefined;

        if (!target) continue;

        if (prefersReducedMotion()) {
          mesh.position.copy(target);
        } else {
          mesh.position.lerp(
            target,
            0.1,
          );

          if (
            mesh.position.distanceToSquared(
              target,
            ) < 0.0000001
          ) {
            mesh.position.copy(target);
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);

      animationFrame =
        window.requestAnimationFrame(
          render,
        );
    }

    render();

    return () => {
      disposed = true;
      actionsRef.current = null;

      window.cancelAnimationFrame(
        animationFrame,
      );

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
          disposeMaterial(
            mesh.material,
          );
        }
      }

      for (
        const promise of
        texturePromises.values()
      ) {
        promise
          .then((texture) =>
            texture.dispose(),
          )
          .catch(() => undefined);
      }

      for (const url of downloadUrls) {
        URL.revokeObjectURL(url);
      }

      for (
        const timer of feedbackTimers
      ) {
        window.clearTimeout(timer);
      }

      floorGeometry.dispose();
      floorMaterial.dispose();
      shadowMaterial.dispose();
      environmentTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [selectedProduct]);

  function openEnvironmentPicker() {
    if (
      status !== "ready" ||
      environmentStatus === "loading"
    ) {
      return;
    }

    setEnvironmentError(null);

    if (environmentInputRef.current) {
      environmentInputRef.current.value =
        "";

      environmentInputRef.current.click();
    }
  }

  function handleEnvironmentFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (
      !environmentFileTypes.includes(
        file.type,
      )
    ) {
      setEnvironmentError(
        "Formato non supportato. Usa una foto JPG, PNG o WebP.",
      );

      setEnvironmentStatus(
        environmentUrlRef.current
          ? "ready"
          : "error",
      );

      return;
    }

    if (file.size === 0) {
      setEnvironmentError(
        "La fotografia è vuota.",
      );

      setEnvironmentStatus(
        environmentUrlRef.current
          ? "ready"
          : "error",
      );

      return;
    }

    if (
      file.size >
      environmentFileMaxBytes
    ) {
      setEnvironmentError(
        "La foto supera 20 MB.",
      );

      setEnvironmentStatus(
        environmentUrlRef.current
          ? "ready"
          : "error",
      );

      return;
    }

    const requestId =
      environmentLoadRequestRef.current +
      1;

    environmentLoadRequestRef.current =
      requestId;

    if (
      environmentPendingUrlRef.current
    ) {
      URL.revokeObjectURL(
        environmentPendingUrlRef.current,
      );
    }

    const candidateUrl =
      URL.createObjectURL(file);

    environmentPendingUrlRef.current =
      candidateUrl;

    setEnvironmentStatus("loading");
    setEnvironmentError(null);
    setExportMessage("");

    const candidate = new Image();

    candidate.decoding = "async";

    candidate.onload = () => {
      if (
        environmentLoadRequestRef.current !==
        requestId
      ) {
        URL.revokeObjectURL(
          candidateUrl,
        );

        return;
      }

      if (
        candidate.naturalWidth < 1 ||
        candidate.naturalHeight < 1 ||
        candidate.naturalWidth *
          candidate.naturalHeight >
          environmentImageMaxPixels
      ) {
        URL.revokeObjectURL(
          candidateUrl,
        );

        environmentPendingUrlRef.current =
          null;

        setEnvironmentError(
          "La foto è troppo grande per questo dispositivo.",
        );

        setEnvironmentStatus(
          environmentUrlRef.current
            ? "ready"
            : "error",
        );

        return;
      }

      const previousUrl =
        environmentUrlRef.current;

      environmentPendingUrlRef.current =
        null;

      environmentUrlRef.current =
        candidateUrl;

      setEnvironmentUrl(candidateUrl);
      setEnvironmentStatus("ready");
      setEnvironmentError(null);

      actionsRef.current?.setEnvironmentEnabled(
        true,
      );

      actionsRef.current?.updateEnvironmentPlacement(
        environmentPlacementRef.current,
      );

      if (
        previousUrl &&
        previousUrl !== candidateUrl
      ) {
        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              previousUrl,
            ),
          0,
        );
      }
    };

    candidate.onerror = () => {
      URL.revokeObjectURL(candidateUrl);

      if (
        environmentLoadRequestRef.current !==
        requestId
      ) {
        return;
      }

      environmentPendingUrlRef.current =
        null;

      setEnvironmentError(
        "Non riesco a leggere questa foto.",
      );

      setEnvironmentStatus(
        environmentUrlRef.current
          ? "ready"
          : "error",
      );
    };

    candidate.src = candidateUrl;
  }

  function changeEnvironmentPlacement(
    property:
      keyof EnvironmentPlacement,
    value: number,
  ) {
    const next = {
      ...environmentPlacementRef.current,
      [property]: value,
    };

    environmentPlacementRef.current =
      next;

    setEnvironmentPlacement(next);

    actionsRef.current?.updateEnvironmentPlacement(
      next,
    );
  }

  function resetEnvironmentPlacement() {
    environmentPlacementRef.current = {
      ...initialEnvironmentPlacement,
    };

    setEnvironmentPlacement({
      ...initialEnvironmentPlacement,
    });

    actionsRef.current?.updateEnvironmentPlacement(
      initialEnvironmentPlacement,
    );
  }

  function removeEnvironment() {
    environmentLoadRequestRef.current += 1;

    if (
      environmentPendingUrlRef.current
    ) {
      URL.revokeObjectURL(
        environmentPendingUrlRef.current,
      );
    }

    if (environmentUrlRef.current) {
      URL.revokeObjectURL(
        environmentUrlRef.current,
      );
    }

    environmentPendingUrlRef.current =
      null;

    environmentUrlRef.current = null;

    environmentPlacementRef.current = {
      ...initialEnvironmentPlacement,
    };

    setEnvironmentUrl(null);
    setEnvironmentStatus("idle");
    setEnvironmentError(null);

    setEnvironmentPlacement({
      ...initialEnvironmentPlacement,
    });

    setExportMessage("");

    actionsRef.current?.setEnvironmentEnabled(
      false,
    );

    actionsRef.current?.updateEnvironmentPlacement(
      initialEnvironmentPlacement,
    );

    if (environmentInputRef.current) {
      environmentInputRef.current.value =
        "";
    }
  }

  function choosePart(
    partId: AtelierPartId,
    moveFocus = false,
  ) {
    setSelectedPart(partId);

    if (moveFocus) {
      window.requestAnimationFrame(
        () =>
          partButtons.current[
            partId
          ]?.focus(),
      );
    }
  }

  function handlePartKeys(
    event: KeyboardEvent<HTMLButtonElement>,
    partId: AtelierPartId,
  ) {
    const ids =
      selectedProduct.parts.map(
        (part) => part.id,
      );

    const index = ids.indexOf(partId);

    let nextIndex: number | null =
      null;

    if (
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      nextIndex =
        (index + 1) % ids.length;
    }

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp"
    ) {
      nextIndex =
        (index - 1 + ids.length) %
        ids.length;
    }

    if (event.key === "Home") {
      nextIndex = 0;
    }

    if (event.key === "End") {
      nextIndex = ids.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();

    choosePart(
      ids[nextIndex],
      true,
    );
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
      selectedProduct.parts.map(
        (part) => [
          part.id,
          selectedMaterial.id,
        ],
      ),
    ) as PartMaterials;

    materialsRef.current = next;
    setPartMaterials(next);

    for (
      const part of
      selectedProduct.parts
    ) {
      void actionsRef.current?.applyMaterial(
        part.id,
        selectedMaterial.id,
      );
    }
  }

  function toggleExploded() {
    if (status !== "ready") return;

    const next = !exploded;

    setExploded(next);

    actionsRef.current?.setExploded(
      next,
    );
  }

  function toggleAutoRotate() {
    if (status !== "ready") return;

    if (
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
    ) {
      setAutoRotate(false);

      actionsRef.current?.setAutoRotate(
        false,
      );

      return;
    }

    const next = !autoRotate;

    setAutoRotate(next);

    actionsRef.current?.setAutoRotate(
      next,
    );
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

    actionsRef.current?.setExploded(
      false,
    );

    actionsRef.current?.setAutoRotate(
      false,
    );

    actionsRef.current?.setView(
      "perspective",
    );
  }

  return (
    <section
      className="atelier-configurator"
      aria-labelledby="configurator-title"
    >
      <div className="viewer-panel">
        <div className="viewer-meta">
          <span>
            Modello Rev.{" "}
            {selectedProduct.revision}
          </span>

          <span>
            {selectedProduct.dimensions}
          </span>
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

        <div
          className="viewer-toolbar"
          aria-label="Controlli del modello tridimensionale"
        >
          <div
            className="view-buttons"
            aria-label="Viste"
          >
            {(
              [
                [
                  "perspective",
                  "Prospettiva",
                ],
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
                aria-pressed={
                  activeView === id
                }
                disabled={
                  status !== "ready"
                }
                onClick={() =>
                  chooseView(id)
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="viewer-actions">
            <button
              type="button"
              aria-pressed={exploded}
              disabled={
                status !== "ready"
              }
              onClick={toggleExploded}
            >
              Esploso
            </button>

            <button
              type="button"
              aria-pressed={autoRotate}
              disabled={
                status !== "ready"
              }
              onClick={toggleAutoRotate}
            >
              Rotazione
            </button>

            <input
              ref={environmentInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={
                handleEnvironmentFile
              }
            />

            <button
              type="button"
              aria-pressed={Boolean(
                environmentUrl,
              )}
              disabled={
                status !== "ready" ||
                environmentStatus ===
                  "loading"
              }
              onClick={
                openEnvironmentPicker
              }
            >
              Ambiente
            </button>

            <button
              type="button"
              disabled={
                status !== "ready"
              }
              onClick={resetView}
            >
              Reimposta vista
            </button>

            <button
              type="button"
              disabled={
                status !== "ready" ||
                environmentStatus ===
                  "loading"
              }
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
            Componi il tuo{" "}
            {selectedProduct.shortName}
          </p>

          <h2 id="configurator-title">
            Materia,
            <br />
            elemento per elemento
          </h2>

          <p>
            Seleziona una parte del
            tavolo, poi scegli la pietra.
            Puoi anche toccare
            direttamente il modello.
          </p>
        </div>

        {(
          environmentUrl ||
          environmentStatus ===
            "loading" ||
          environmentError
        ) && (
          <div
            className="control-section environment-controls"
            aria-labelledby="environment-controls-title"
          >
            <div className="control-title">
              <span>A</span>

              <strong id="environment-controls-title">
                Ambiente reale
              </strong>
            </div>

            {environmentStatus ===
              "loading" && (
              <p
                className="environment-status"
                role="status"
              >
                Preparo la fotografia
                dell’ambiente…
              </p>
            )}

            {environmentError && (
              <p
                className="environment-error"
                role="alert"
              >
                {environmentError}
              </p>
            )}

            {environmentUrl && (
              <>
                <p className="environment-ready">
                  Foto pronta. Regola il
                  tavolo per inserirlo
                  visivamente nello spazio.
                </p>

                <label>
                  <span>
                    Dimensione tavolo
                  </span>

                  <output>
                    {Math.round(
                      environmentPlacement.scale *
                        100,
                    )}
                    %
                  </output>

                  <input
                    type="range"
                    min="0.65"
                    max="1.45"
                    step="0.01"
                    value={
                      environmentPlacement.scale
                    }
                    onChange={(event) =>
                      changeEnvironmentPlacement(
                        "scale",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Posizione orizzontale
                  </span>

                  <output>
                    {
                      environmentPlacement.x
                    }
                  </output>

                  <input
                    type="range"
                    min="-30"
                    max="30"
                    step="1"
                    value={
                      environmentPlacement.x
                    }
                    onChange={(event) =>
                      changeEnvironmentPlacement(
                        "x",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Posizione verticale
                  </span>

                  <output>
                    {
                      environmentPlacement.y
                    }
                  </output>

                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="1"
                    value={
                      environmentPlacement.y
                    }
                    onChange={(event) =>
                      changeEnvironmentPlacement(
                        "y",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Intensità ombra
                  </span>

                  <output>
                    {Math.round(
                      environmentPlacement.shadow *
                        100,
                    )}
                    %
                  </output>

                  <input
                    type="range"
                    min="0"
                    max="0.45"
                    step="0.01"
                    value={
                      environmentPlacement.shadow
                    }
                    onChange={(event) =>
                      changeEnvironmentPlacement(
                        "shadow",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                  />
                </label>

                <div className="environment-actions">
                  <button
                    type="button"
                    onClick={
                      resetEnvironmentPlacement
                    }
                  >
                    Centra il tavolo
                  </button>

                  <button
                    type="button"
                    onClick={
                      openEnvironmentPicker
                    }
                  >
                    Sostituisci foto
                  </button>

                  <button
                    type="button"
                    onClick={
                      removeEnvironment
                    }
                  >
                    Rimuovi foto
                  </button>
                </div>

                <p className="environment-note">
                  La foto resta sul tuo
                  dispositivo e non viene
                  caricata né conservata.
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

          <div
            className="part-tabs"
            role="radiogroup"
            aria-label="Componente da configurare"
            style={{
              gridTemplateColumns: `repeat(${selectedProduct.parts.length}, minmax(0, 1fr))`,
            }}
          >
            {selectedProduct.parts.map(
              (part) => (
                <button
                  key={part.id}
                  ref={(element) => {
                    partButtons.current[
                      part.id
                    ] = element;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={
                    selectedPart ===
                    part.id
                  }
                  tabIndex={
                    selectedPart ===
                    part.id
                      ? 0
                      : -1
                  }
                  className={
                    selectedPart ===
                    part.id
                      ? "is-active"
                      : ""
                  }
                  onKeyDown={(event) =>
                    handlePartKeys(
                      event,
                      part.id,
                    )
                  }
                  onClick={() =>
                    choosePart(part.id)
                  }
                >
                  <span>
                    {part.shortLabel}
                  </span>

                  <small>
                    {part.role === "plane"
                      ? "Piano"
                      : "Gamba"}
                  </small>
                </button>
              ),
            )}
          </div>

          <p className="part-specification">
            {
              selectedPartDefinition.specification
            }
          </p>
        </div>

        <div className="control-section materials-section">
          <div className="control-title">
            <span>02</span>
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
                {
                  selectedPartDefinition.label
                }
              </small>

              <strong>
                {selectedMaterial.name}
              </strong>
            </div>
          </div>

          <div
            className="material-grid"
            aria-label={`Pietre per ${selectedPartDefinition.label}`}
          >
            {stoneMaterials.map(
              (material) => {
                const allowed =
                  material.allowedOn.includes(
                    selectedPartDefinition.role,
                  );

                const active =
                  selectedMaterial.id ===
                  material.id;

                return (
                  <button
                    key={material.id}
                    type="button"
                    className={
                      active
                        ? "is-active"
                        : ""
                    }
                    disabled={!allowed}
                    aria-pressed={active}
                    title={
                      allowed
                        ? material.name
                        : `${material.name}: disponibile solo per i piani`
                    }
                    onClick={() =>
                      chooseMaterial(
                        material,
                      )
                    }
                  >
                    <span className="material-thumb">
                      <img
                        src={
                          material.texture
                        }
                        alt=""
                        loading="lazy"
                      />
                    </span>

                    <span className="material-name">
                      {material.name}
                    </span>

                    {!allowed && (
                      <small>
                        Solo piani
                      </small>
                    )}
                  </button>
                );
              },
            )}
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

            <span aria-hidden="true">
              →
            </span>
          </button>
        </div>

        <div className="control-section rendering-controls">
          <div className="control-title">
            <span>03</span>

            <strong>
              Resa indicativa
            </strong>
          </div>

          <label>
            <span>Scala venatura</span>

            <output>
              {Math.round(
                textureScale * 100,
              )}
              %
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

                textureScaleRef.current =
                  value;

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
              {Math.round(exposure * 100)}
              %
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

                exposureRef.current =
                  value;

                setExposure(value);

                actionsRef.current?.setExposure(
                  value,
                );
              }}
            />
          </label>

          <p>
            Ogni lastra naturale è
            unica. Venature, tono e
            disposizione reale saranno
            verificati sulla lastra
            selezionata.
          </p>
        </div>
      </aside>
    </section>
  );
}
