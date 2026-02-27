export interface WorldConnection {
  target: string;
  label: string;
}

export interface WorldMapLocation {
  slug: string;
  name: string;
  description: string;
  image: string;
  size?: 1 | 2 | 3; // tile scale: 1=small, 2=medium (default), 3=large
  connections: WorldConnection[];
  children?: WorldMapLocation[]; // fractal sub-locations
}

export interface WorldMapCluster {
  id: string;
  name: string;
  description: string;
  color?: string;
  locations: string[];
}

export interface WorldMapData {
  defaultLocation: string;
  clusters: WorldMapCluster[];
  locations: WorldMapLocation[];
}
