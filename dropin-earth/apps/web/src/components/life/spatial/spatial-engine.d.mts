export type SpatialLocale = 'zh' | 'en';
export interface SpatialOptions {
  locale?: SpatialLocale;
  loadScene?: boolean;
}
export interface SpatialMount {
  getState(): {
    activeTab: string; selectedRoom: string; selectedNode: string; floor: string;
    step: number; taskId: string; externalActions: 0;
    scene: { threeRevision: string; renderer: string; calls: number; triangles: number; geometries: number; source: string; externalActions: 0 } | null;
  };
  dispose(): void;
}
export function mountSpatialOperations(root: HTMLElement, options?: SpatialOptions): SpatialMount;
