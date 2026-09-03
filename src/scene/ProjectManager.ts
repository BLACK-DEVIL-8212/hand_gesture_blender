import type { SceneGraph } from './types';
import { EVENTS } from '../core/Configuration';
import type EventBus from '../core/EventBus';
import logger from '../core/Logger';

export interface ProjectMetadata {
  name: string;
  description: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  author?: string;
  tags?: string[];
}

export interface ProjectFile {
  metadata: ProjectMetadata;
  scene: SceneGraph;
  settings: Record<string, unknown>;
}

export const PROJECT_EXTENSION = '.my3d';
export const PROJECT_VERSION = '1.0.0';

export class ProjectManager {
  private eventBus: EventBus;
  private currentProject: ProjectFile | null = null;
  private projectPath: string | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  createNewProject(name: string = 'Untitled Project'): ProjectFile {
    this.currentProject = {
      metadata: {
        name,
        description: '',
        version: PROJECT_VERSION,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      scene: this.emptyScene(),
      settings: {},
    };
    this.projectPath = null;
    logger.info(`Project created: ${name}`);
    this.eventBus.emit(EVENTS.PROJECT.PROJECT_CREATED, { name });
    return this.currentProject;
  }

  private emptyScene(): SceneGraph {
    return {
      id: 'scene_' + Date.now().toString(36),
      name: 'Scene',
      objects: {},
      rootIds: [],
      cameraId: null,
      environment: {
        backgroundColor: '#1a1a2e',
        fogEnabled: false,
        fogColor: '#000000',
        fogNear: 10,
        fogFar: 100,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {},
    };
  }

  setCurrentProject(project: ProjectFile): void {
    this.currentProject = project;
  }

  getCurrentProject(): ProjectFile | null {
    return this.currentProject;
  }

  getProjectPath(): string | null {
    return this.projectPath;
  }

  setProjectPath(path: string): void {
    this.projectPath = path;
  }

  saveProject(project?: ProjectFile): string {
    const proj = project || this.currentProject;
    if (!proj) throw new Error('No project to save');
    
    proj.metadata.updatedAt = Date.now();
    const content = this.serializeProject(proj);
    
    if (this.projectPath) {
      this.writeLocal(this.projectPath, content);
      logger.info(`Project saved: ${this.projectPath}`);
    } else {
      const filename = this.sanitizeFilename(proj.metadata.name) + PROJECT_EXTENSION;
      this.downloadFile(content, filename);
      this.projectPath = filename;
      logger.info(`Project saved as: ${filename}`);
    }
    
    this.currentProject = proj;
    this.eventBus.emit(EVENTS.PROJECT.PROJECT_SAVED, { project: proj });
    return this.projectPath;
  }

  saveProjectAs(project: ProjectFile, path: string): string {
    this.projectPath = path;
    return this.saveProject(project);
  }

  async openProject(file?: File): Promise<ProjectFile | null> {
    if (file) {
      return this.loadFromFile(file);
    }
    
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = PROJECT_EXTENSION + ',.json,application/json';
      input.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          const result = await this.loadFromFile(files[0]);
          resolve(result);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }

  private async loadFromFile(file: File): Promise<ProjectFile | null> {
    try {
      const content = await file.text();
      const project = this.deserializeProject(content);
      this.currentProject = project;
      this.projectPath = file.name;
      logger.info(`Project loaded: ${file.name}`);
      this.eventBus.emit(EVENTS.PROJECT.PROJECT_LOADED, { project });
      return project;
    } catch (e) {
      logger.error('Failed to load project', e);
      throw e;
    }
  }

  serializeProject(project: ProjectFile): string {
    return JSON.stringify(project, null, 2);
  }

  deserializeProject(content: string): ProjectFile {
    const data = JSON.parse(content);
    
    if (data.version !== PROJECT_VERSION) {
      logger.warn(`Project version mismatch: ${data.version} vs ${PROJECT_VERSION}`);
    }
    
    return data as ProjectFile;
  }

  exportToGLTF(scene: SceneGraph): Promise<Blob> {
    return new Promise((resolve) => {
      this.eventBus.emit(EVENTS.PROJECT.PROJECT_EXPORTED, { format: 'GLTF' });
      resolve(new Blob([JSON.stringify(scene, null, 2)], { type: 'model/gltf+json' }));
    });
  }

  exportToOBJ(scene: SceneGraph): Promise<Blob> {
    return new Promise((resolve) => {
      this.eventBus.emit(EVENTS.PROJECT.PROJECT_EXPORTED, { format: 'OBJ' });
      const obj = this.convertToOBJ(scene);
      resolve(new Blob([obj], { type: 'text/plain' }));
    });
  }

  exportToSTL(scene: SceneGraph): Promise<Blob> {
    return new Promise((resolve) => {
      this.eventBus.emit(EVENTS.PROJECT.PROJECT_EXPORTED, { format: 'STL' });
      const stl = this.convertToSTL(scene);
      resolve(new Blob([stl], { type: 'application/sla' }));
    });
  }

  private convertToOBJ(scene: SceneGraph): string {
    const lines: string[] = [];
    lines.push('# HandControl Blender Export');
    lines.push('# Wavefront OBJ');
    lines.push('');
    
    let vertexOffset = 1;
    let normalOffset = 1;
    
    for (const [, obj] of Object.entries(scene.objects)) {
      lines.push(`o ${obj.name}`);
      
      const geo = this.getObjectGeometry(obj);
      const { vertices, normals, indices } = geo;
      
      for (const v of vertices) {
        lines.push(`v ${v[0]} ${v[1]} ${v[2]}`);
      }
      
      for (const n of normals) {
        lines.push(`vn ${n[0]} ${n[1]} ${n[2]}`);
      }
      
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] + vertexOffset;
        const b = indices[i + 1] + vertexOffset;
        const c = indices[i + 2] + vertexOffset;
        const na = normalOffset + (i / 3);
        lines.push(`f ${a}//${na} ${b}//${na} ${c}//${na}`);
      }
      
      vertexOffset += vertices.length;
      normalOffset += normals.length;
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private convertToSTL(scene: SceneGraph): string {
    const lines: string[] = [];
    lines.push('solid HandControlBlender');
    
    for (const obj of Object.values(scene.objects)) {
      if (obj.type === 'camera' || obj.type === 'light') continue;
      
      const geo = this.getObjectGeometry(obj);
      for (let i = 0; i < geo.indices.length; i += 3) {
        const a = geo.indices[i];
        const b = geo.indices[i + 1];
        const c = geo.indices[i + 2];
        
        const va = geo.vertices[a];
        const vb = geo.vertices[b];
        const vc = geo.vertices[c];
        
        const ax = vb[0] - va[0];
        const ay = vb[1] - va[1];
        const az = vb[2] - va[2];
        const bx = vc[0] - va[0];
        const by = vc[1] - va[1];
        const bz = vc[2] - va[2];
        
        const nx = ay * bz - az * by;
        const ny = az * bx - ax * bz;
        const nz = ax * by - ay * bx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        
        const n = len > 0 ? [nx / len, ny / len, nz / len] : [0, 0, 1];
        
        lines.push(`  facet normal ${n[0]} ${n[1]} ${n[2]}`);
        lines.push('    outer loop');
        lines.push(`      vertex ${va[0]} ${va[1]} ${va[2]}`);
        lines.push(`      vertex ${vb[0]} ${vb[1]} ${vb[2]}`);
        lines.push(`      vertex ${vc[0]} ${vc[1]} ${vc[2]}`);
        lines.push('    endloop');
        lines.push('  endfacet');
      }
    }
    
    lines.push('endsolid HandControlBlender');
    return lines.join('\n');
  }

  private getObjectGeometry(obj: any): { vertices: number[][]; normals: number[][]; indices: number[] } {
    const type = obj.type;
    const scale = obj.transform.scale;
    const s = [(scale.x || scale) as number || 1, (scale.y || scale) as number || 1, (scale.z || scale) as number || 1];
    
    switch (type) {
      case 'cube':
        return this.cubeGeometry(s);
      case 'sphere':
        return this.sphereGeometry(s);
      case 'cylinder':
        return this.cylinderGeometry(s);
      case 'plane':
        return this.planeGeometry(s);
      case 'cone':
        return this.coneGeometry(s);
      case 'torus':
        return this.torusGeometry(s);
      default:
        return this.cubeGeometry([1, 1, 1]);
    }
  }

  private cubeGeometry(s: number[]): { vertices: number[][]; normals: number[][]; indices: number[] } {
    const [w, h, d] = s.map(v => v / 2);
    const vertices = [
      [-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d],
      [-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d],
    ];
    const indices = [
      0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
      0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2,
      2, 6, 7, 2, 7, 3, 0, 3, 7, 0, 7, 4,
    ];
    const normals = [
      [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
      [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1],
    ];
    return { vertices, normals, indices };
  }

  private sphereGeometry(s: number[]): { vertices: number[][]; normals: number[][]; indices: number[] } {
    const [r] = s;
    const segments = 16;
    const rings = 12;
    const vertices: number[][] = [];
    const indices: number[] = [];
    
    for (let i = 0; i <= rings; i++) {
      for (let j = 0; j <= segments; j++) {
        const phi = (i / rings) * Math.PI;
        const theta = (j / segments) * Math.PI * 2;
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);
        vertices.push([x, y, z]);
      }
    }
    
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j;
        const b = a + segments + 1;
        const c = a + 1;
        const d = c + segments + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
    
    const normals = vertices.map(v => {
      const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
      return len > 0 ? v.map(c => c / len) : [0, 1, 0];
    });
    
    return { vertices, normals, indices };
  }

  private cylinderGeometry(s: number[]): { vertices: number[][]; normals: number[][]; indices: number[] } {
    const [r, h] = s;
    const halfH = h / 2;
    const segments = 16;
    const vertices: number[][] = [];
    const indices: number[] = [];
    
    vertices.push([0, halfH, 0]);
    vertices.push([0, -halfH, 0]);
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      vertices.push([x, halfH, z]);
      vertices.push([x, -halfH, z]);
    }
    
    for (let i = 0; i < segments; i++) {
      const idx = 2 + i * 2;
      const next = 2 + ((i + 1) % segments) * 2;
      indices.push(0, idx, next);
      indices.push(1, next + 1, idx + 1);
      indices.push(idx, idx + 1, next + 1);
      indices.push(idx, next + 1, next);
    }
    
    const normals = vertices.map(v => {
      const len = Math.sqrt(v[0] ** 2 + v[2] ** 2);
      return len > 0 ? [v[0] / len, 0, v[2] / len] : [0, 0, 1];
    });
    
    return { vertices, normals, indices };
  }

  private coneGeometry(s: number[]): { vertices: number[][]; normals: number[][]; indices: number[] } {
    const [r, h] = s;
    const halfH = h / 2;
    const segments = 16;
    const vertices: number[][] = [];
    const indices: number[] = [];
    
    vertices.push([0, halfH, 0]);
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      vertices.push([x, -halfH, z]);
    }
    
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      indices.push(0, i, next);
    }
    
    indices.push(segments + 1, 1, segments);
    
    const normals = vertices.map(v => {
      const len = Math.sqrt(v[0] ** 2 + v[2] ** 2);
      return len > 0 ? [v[0] / len, 0, v[2] / len] : [0, 0, 1];
    });
    normals[0] = [0, 1, 0];
    
    return { vertices, normals, indices };
  }

  private planeGeometry(s: number[]): { vertices: number[][]; normals: number[][]; indices: number[] } {
    const [w, d] = s;
    const halfW = w / 2;
    const halfD = d / 2;
    const vertices = [
      [-halfW, 0, -halfD], [halfW, 0, -halfD], [halfW, 0, halfD], [-halfW, 0, halfD],
    ];
    const indices = [0, 2, 1, 0, 3, 2];
    const normals = [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]];
    return { vertices, normals, indices };
  }

  private torusGeometry(s: number[]): { vertices: number[][]; normals: number[][]; indices: number[] } {
    const [r, t] = s;
    const segments = 24;
    const tubeSegments = 16;
    const vertices: number[][] = [];
    const indices: number[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const cx = (r + t) * Math.cos(u * Math.PI * 2);
      const cz = (r + t) * Math.sin(u * Math.PI * 2);
      
      for (let j = 0; j <= tubeSegments; j++) {
        const v = j / tubeSegments;
        const angle = v * Math.PI * 2;
        const x = cx + t * Math.cos(angle) * Math.cos(u * Math.PI * 2);
        const y = t * Math.sin(angle);
        const z = cz + t * Math.cos(angle) * Math.sin(u * Math.PI * 2);
        vertices.push([x, y, z]);
      }
    }
    
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < tubeSegments; j++) {
        const a = i * (tubeSegments + 1) + j;
        const b = ((i + 1) % segments) * (tubeSegments + 1) + j;
        indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    
    const normals = vertices.map(v => {
      const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
      return len > 0 ? v.map(c => c / len) : [0, 1, 0];
    });
    
    return { vertices, normals, indices };
  }

  private downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private writeLocal(path: string, content: string): void {
    this.downloadFile(content, path);
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}

export default ProjectManager;
