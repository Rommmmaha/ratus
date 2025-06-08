// Shared types for ratus-admin


export interface User {
  id: string;
  name: string;
  ip: string;
  screen: string;
  mouse: { x: number; y: number };
}

export enum MouseEventType {
  MOUSE_DOWN = "mousedown",
  MOUSE_UP = "mouseup",
  MOUSE_MOVE = "mousemove",
  MOUSE_CLICK = "click",
  MOUSE_WHEEL = "mousewheel",
}

export interface MouseAction {
  event: MouseEventType;
  key: number | null;
  x: number;
  y: number;
}

export type UserId = string;
