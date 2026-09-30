import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { DeviceStatus, RestrictedZone } from "@harborwatch/contracts";
import type { LayerState } from "../lib/store";
import type { SensorRecord, TrackRecord } from "../lib/api";
import { headingToYRotation, lerpRadians, ORIGIN, toLocal, type GeoOrigin } from "../lib/geo";

const NAVY = 0x002c54;
const SEA = 0x006098;
const TEAL = 0x00a0b8;
const BEAM = 0xace0e8;
const DEEP = 0x001428;

const TYPE_COLOR: Record<string, number> = {
  vessel: TEAL,
  vehicle: SEA,
  person: BEAM,
  unknown: 0x8aa0b4,
};

export interface HarborWorldOptions {
  onSelect: (trackId: string | null) => void;
  origin?: GeoOrigin;
  zones?: RestrictedZone[];
}

export class HarborWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly clock = new THREE.Clock();
  private readonly tracks = new Map<string, TrackMesh>();
  private readonly trailLines = new Map<string, THREE.Line>();
  private readonly sensors = new Map<string, THREE.Object3D>();
  private readonly devices = new Map<string, THREE.Object3D>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly water: THREE.Mesh;
  private readonly beam: THREE.SpotLight;
  private readonly lighthouse: THREE.Object3D;
  private readonly envGroup = new THREE.Group();
  private readonly zoneGroup = new THREE.Group();
  private readonly sensorGroup = new THREE.Group();
  private readonly deviceGroup = new THREE.Group();
  private readonly trackGroup = new THREE.Group();
  private readonly trailGroup = new THREE.Group();
  private selectedId: string | null = null;
  private raf = 0;
  private disposed = false;
  private windDir = 210;
  private windArrow: THREE.Object3D;
  private haze: THREE.Mesh;
  private readonly origin: GeoOrigin;

  constructor(
    private readonly host: HTMLElement,
    private readonly options: HarborWorldOptions,
  ) {
    this.origin = options.origin ?? ORIGIN;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(DEEP);
    this.scene.fog = new THREE.FogExp2(DEEP, 0.0016);

    const width = host.clientWidth || 800;
    const height = host.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 4000);
    this.camera.position.set(-180, 140, 220);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 8, 0);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 40;
    this.controls.maxDistance = 700;

    this.scene.add(new THREE.HemisphereLight(0xace0e8, NAVY, 0.7));
    const sun = new THREE.DirectionalLight(0xe8f8f8, 1.1);
    sun.position.set(-120, 220, 80);
    this.scene.add(sun);

    this.water = this.buildWater();
    this.scene.add(this.water);
    this.scene.add(this.buildLand());
    this.lighthouse = this.buildLighthouse();
    this.scene.add(this.lighthouse);
    this.beam = new THREE.SpotLight(BEAM, 18, 420, 0.28, 0.45, 1.1);
    this.beam.position.set(-70, 62, 40);
    this.beam.target.position.set(40, 0, -20);
    this.scene.add(this.beam);
    this.scene.add(this.beam.target);
    this.scene.add(this.buildCranes());
    this.scene.add(this.buildPiers());
    this.buildZones(options.zones ?? []);
    this.scene.add(this.zoneGroup);
    this.scene.add(this.trackGroup);
    this.scene.add(this.trailGroup);
    this.scene.add(this.sensorGroup);
    this.scene.add(this.deviceGroup);
    this.scene.add(this.envGroup);
    this.windArrow = this.buildWindArrow();
    this.envGroup.add(this.windArrow);
    this.haze = this.buildHaze();
    this.envGroup.add(this.haze);

    this.renderer.domElement.addEventListener("pointerdown", this.onPointer);
    window.addEventListener("resize", this.onResize);
    this.loop();
  }

  setLayers(layers: LayerState): void {
    this.trackGroup.visible = layers.objectTracks;
    this.trailGroup.visible = layers.trackHistory;
    this.sensorGroup.visible = layers.sensors;
    this.envGroup.visible = layers.environment;
    this.zoneGroup.visible = layers.restrictedZones;
    this.deviceGroup.visible = layers.devices;
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    for (const [trackId, mesh] of this.tracks) {
      mesh.setSelected(trackId === id);
    }
  }

  setEnvironment(windDir: number, visibility: number): void {
    this.windDir = windDir;
    this.windArrow.rotation.y = -((windDir * Math.PI) / 180);
    const density = visibility < 4000 ? 0.0032 : visibility < 7000 ? 0.002 : 0.0012;
    (this.scene.fog as THREE.FogExp2).density = density;
    (this.haze.material as THREE.MeshBasicMaterial).opacity =
      visibility < 5000 ? 0.22 : 0.08;
  }

  syncTracks(tracks: Iterable<TrackRecord>): void {
    const seen = new Set<string>();
    for (const track of tracks) {
      seen.add(track.track_id);
      let mesh = this.tracks.get(track.track_id);
      if (!mesh) {
        mesh = new TrackMesh(track.object_type, track.track_id);
        this.tracks.set(track.track_id, mesh);
        this.trackGroup.add(mesh.group);
        const line = makeTrail(TYPE_COLOR[track.object_type] ?? TEAL);
        this.trailLines.set(track.track_id, line);
        this.trailGroup.add(line);
      }
      const { x, z } = toLocal(track.latitude, track.longitude, this.origin);
      mesh.setPose(x, track.altitude, z, headingToYRotation(track.heading), track.stale === true);
      mesh.setSelected(track.track_id === this.selectedId);
      pushTrail(this.trailLines.get(track.track_id)!, x, track.altitude + 0.6, z);
    }
    for (const id of [...this.tracks.keys()]) {
      if (seen.has(id)) continue;
      const mesh = this.tracks.get(id);
      if (mesh) this.trackGroup.remove(mesh.group);
      const line = this.trailLines.get(id);
      if (line) this.trailGroup.remove(line);
      this.tracks.delete(id);
      this.trailLines.delete(id);
    }
  }

  syncSensors(sensors: SensorRecord[]): void {
    for (const sensor of sensors) {
      let node = this.sensors.get(sensor.sensor_id);
      if (!node) {
        node = this.buildSensor(sensor.sensor_id);
        this.sensors.set(sensor.sensor_id, node);
        this.sensorGroup.add(node);
      }
      const { x, z } = toLocal(sensor.latitude, sensor.longitude, this.origin);
      node.position.set(x, 0, z);
      const light = node.getObjectByName("status") as THREE.Mesh;
      const status = sensor.telemetry?.status ?? "operational";
      const color = status === "operational" ? TEAL : status === "degraded" ? 0xf0c060 : 0x8a2030;
      (light.material as THREE.MeshStandardMaterial).emissive.setHex(color);
    }
  }

  syncDevices(devices: DeviceStatus[]): void {
    for (const device of devices) {
      if (device.latitude === undefined || device.longitude === undefined) continue;
      let node = this.devices.get(device.device_id);
      if (!node) {
        node = this.buildDevice();
        this.devices.set(device.device_id, node);
        this.deviceGroup.add(node);
      }
      const { x, z } = toLocal(device.latitude, device.longitude, this.origin);
      node.position.set(x, 1.2, z);
      node.visible = device.connected;
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointer);
    window.removeEventListener("resize", this.onResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private loop = (): void => {
    if (this.disposed) return;
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;
    for (const mesh of this.tracks.values()) mesh.tick(dt);
    const waterMat = this.water.material as THREE.ShaderMaterial;
    waterMat.uniforms.uTime.value = t;
    this.beam.target.position.set(Math.cos(t * 0.35) * 160, 0, Math.sin(t * 0.35) * 160);
    this.lighthouse.getObjectByName("lamp")!.rotation.y = t * 0.35;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  private onResize = (): void => {
    const width = this.host.clientWidth || 800;
    const height = this.host.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onPointer = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.trackGroup.children, true);
    const hit = hits.find((h) => h.object.userData.trackId);
    this.options.onSelect(hit ? String(hit.object.userData.trackId) : null);
  };

  private buildWater(): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(1400, 1400, 80, 80);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(NAVY) },
        uShallow: { value: new THREE.Color(SEA) },
        uGrid: { value: new THREE.Color(TEAL) },
      },
      vertexShader: `
        varying vec3 vPos;
        uniform float uTime;
        void main() {
          vec3 p = position;
          p.y += sin(p.x * 0.02 + uTime * 0.8) * 0.7 + cos(p.z * 0.018 + uTime * 0.6) * 0.5;
          vPos = p;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uGrid;
        void main() {
          float grid = abs(sin(vPos.x * 0.08)) * abs(sin(vPos.z * 0.08));
          float mixv = smoothstep(-4.0, 8.0, vPos.y);
          vec3 color = mix(uDeep, uShallow, mixv);
          color = mix(color, uGrid, grid * 0.18);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    return new THREE.Mesh(geom, mat);
  }

  private buildLand(): THREE.Group {
    const group = new THREE.Group();
    const quay = new THREE.Mesh(
      new THREE.BoxGeometry(220, 6, 90),
      new THREE.MeshStandardMaterial({ color: 0x1a3b5c, roughness: 0.85 }),
    );
    quay.position.set(-90, 2.8, 95);
    group.add(quay);
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(160, 4, 36),
      new THREE.MeshStandardMaterial({ color: 0x16324e }),
    );
    apron.position.set(-40, 1.8, 48);
    group.add(apron);
    for (let i = 0; i < 6; i += 1) {
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(18 + (i % 3) * 6, 14 + (i % 4) * 8, 16),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? NAVY : 0x08345c,
          emissive: TEAL,
          emissiveIntensity: 0.08,
          roughness: 0.6,
        }),
      );
      building.position.set(-150 + i * 28, 10, 118);
      group.add(building);
    }
    return group;
  }

  private buildLighthouse(): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(-72, 0, 42);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 9, 8, 8),
      new THREE.MeshStandardMaterial({ color: NAVY }),
    );
    base.position.y = 4;
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 5.2, 46, 10),
      new THREE.MeshStandardMaterial({ color: 0x0b3a63, roughness: 0.45 }),
    );
    tower.position.y = 30;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(3.1, 16, 16),
      new THREE.MeshStandardMaterial({ color: BEAM, emissive: BEAM, emissiveIntensity: 1.4 }),
    );
    lamp.position.y = 54;
    lamp.name = "lamp";
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(4.2, 6, 8),
      new THREE.MeshStandardMaterial({ color: TEAL }),
    );
    cap.position.y = 59;
    group.add(base, tower, lamp, cap);
    return group;
  }

  private buildCranes(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: SEA, metalness: 0.4, roughness: 0.35 });
    for (const x of [-20, 18]) {
      const mast = new THREE.Mesh(new THREE.BoxGeometry(3, 48, 3), mat);
      mast.position.set(x, 24, 62);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(54, 2, 2), mat);
      arm.position.set(x + 18, 46, 62);
      group.add(mast, arm);
    }
    return group;
  }

  private buildPiers(): THREE.Group {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x0d2f4c });
    for (let i = 0; i < 3; i += 1) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 70), wood);
      pier.position.set(-30 + i * 22, 1.2, 10);
      group.add(pier);
    }
    return group;
  }

  private buildZones(zones: RestrictedZone[]): void {
    const mat = new THREE.MeshStandardMaterial({
      color: TEAL,
      transparent: true,
      opacity: 0.18,
      emissive: TEAL,
      emissiveIntensity: 0.2,
    });
    for (const zone of zones) {
      const ring = zone.polygon.coordinates[0] ?? [];
      const pts = ring.map(([lon, lat]) => toLocal(lat, lon, this.origin));
      if (pts.length < 3) continue;
      const xs = pts.map((p) => p.x);
      const zs = pts.map((p) => p.z);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(8, maxX - minX), 0.4, Math.max(8, maxZ - minZ)),
        mat,
      );
      mesh.position.set((minX + maxX) / 2, 0.4, (minZ + maxZ) / 2);
      this.zoneGroup.add(mesh);
    }
  }

  private buildSensor(id: string): THREE.Object3D {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 16, 8),
      new THREE.MeshStandardMaterial({ color: NAVY }),
    );
    pole.position.y = 8;
    const status = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 12, 12),
      new THREE.MeshStandardMaterial({ color: TEAL, emissive: TEAL, emissiveIntensity: 0.8 }),
    );
    status.position.y = 16.4;
    status.name = "status";
    status.userData.sensorId = id;
    group.add(pole, status);
    return group;
  }

  private buildDevice(): THREE.Object3D {
    return new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.2, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x007ca8, emissive: 0x00a0b8, emissiveIntensity: 0.15 }),
    );
  }

  private buildWindArrow(): THREE.Object3D {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: BEAM, emissive: BEAM, emissiveIntensity: 0.4 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 28, 8), mat);
    shaft.rotation.z = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 8), mat);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 16;
    group.add(shaft, head);
    group.position.set(90, 18, -40);
    return group;
  }

  private buildHaze(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshBasicMaterial({
        color: 0xe8f8f8,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 12;
    return mesh;
  }
}

class TrackMesh {
  readonly group = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly current = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private currentRot = 0;
  private targetRot = 0;
  private hasPose = false;

  constructor(type: string, trackId: string) {
    const color = TYPE_COLOR[type] ?? TEAL;
    const geom =
      type === "vessel"
        ? new THREE.BoxGeometry(7.5, 1.8, 2.4)
        : type === "vehicle"
          ? new THREE.BoxGeometry(3.4, 1.4, 2.2)
          : type === "person"
            ? new THREE.CylinderGeometry(0.55, 0.7, 1.8, 8)
            : new THREE.OctahedronGeometry(1.6);
    this.body = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        metalness: 0.2,
        roughness: 0.4,
      }),
    );
    this.body.userData.trackId = trackId;
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.18, 8, 32),
      new THREE.MeshBasicMaterial({ color: BEAM }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    this.group.add(this.body, this.ring);
    this.group.userData.trackId = trackId;
  }

  setPose(x: number, y: number, z: number, rotY: number, stale: boolean): void {
    this.target.set(x, Math.max(y, 0.6), z);
    this.targetRot = rotY;
    (this.body.material as THREE.MeshStandardMaterial).opacity = stale ? 0.45 : 1;
    (this.body.material as THREE.MeshStandardMaterial).transparent = stale;
    if (!this.hasPose) {
      this.current.copy(this.target);
      this.currentRot = rotY;
      this.hasPose = true;
      this.applyPose();
    }
  }

  tick(dt: number): void {
    if (!this.hasPose) return;
    const k = 1 - Math.exp(-dt * 7);
    this.current.lerp(this.target, k);
    this.currentRot = lerpRadians(this.currentRot, this.targetRot, k);
    this.applyPose();
  }

  private applyPose(): void {
    this.group.position.copy(this.current);
    this.group.rotation.y = this.currentRot;
  }

  setSelected(selected: boolean): void {
    this.ring.visible = selected;
    (this.body.material as THREE.MeshStandardMaterial).emissiveIntensity = selected ? 0.9 : 0.35;
  }
}

function makeTrail(color: number): THREE.Line {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(24 * 3);
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
  return new THREE.Line(geom, mat);
}

function pushTrail(line: THREE.Line, x: number, y: number, z: number): void {
  const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  const count = Math.min(24, (line.userData.len ?? 0) + 1);
  for (let i = count - 1; i > 0; i -= 1) {
    attr.setXYZ(i, attr.getX(i - 1), attr.getY(i - 1), attr.getZ(i - 1));
  }
  attr.setXYZ(0, x, y, z);
  attr.needsUpdate = true;
  line.geometry.setDrawRange(0, count);
  line.userData.len = count;
}
