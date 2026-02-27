export interface WorldConnection {
  target: string;
  label: string;
}

export interface WorldMapLocation {
  slug: string;
  name: string;
  description: string;
  image: string;
  connections: WorldConnection[];
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
