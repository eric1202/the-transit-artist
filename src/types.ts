export interface Point {
  x: number;
  y: number;
}

export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  isTransfer: boolean;
}

export interface Line {
  id: string;
  name: string;
  color: string;
  stationIds: string[];
  number: string;
  isVisible: boolean;
}

export interface MetroSystem {
  name: string;
  stations: Station[];
  lines: Line[];
}

export type Tool = 'select' | 'station' | 'line' | 'eraser';
