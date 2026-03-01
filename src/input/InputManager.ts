// src/input/InputManager.ts
export interface InputState {
  // Movement (WASD only, no up/down)
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;

  // Reset
  reset: boolean;

  // Mouse buttons
  mouseLeftDown: boolean;
  mouseRightDown: boolean;
  mouseMiddleDown: boolean;

  // Mouse position and delta
  mouseX: number;
  mouseY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;

  // Scroll (keeping for potential future use)
  scrollDelta: number;
}

export class InputManager {
  private state: InputState;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = this.createDefaultState();
    this.setupEventListeners();
  }

  private createDefaultState(): InputState {
    return {
      forward: false,
      backward: false,
      left: false,
      right: false,
      reset: false,
      mouseLeftDown: false,
      mouseRightDown: false,
      mouseMiddleDown: false,
      mouseX: 0,
      mouseY: 0,
      mouseDeltaX: 0,
      mouseDeltaY: 0,
      scrollDelta: 0,
    };
  }

  private setupEventListeners(): void {
    // Keyboard
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Mouse
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    // Context menu prevention
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.updateKeyState(e.code, true);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.updateKeyState(e.code, false);
  };

  private updateKeyState(code: string, pressed: boolean): void {
    switch (code) {
      case 'KeyW': this.state.forward = pressed; break;
      case 'KeyS': this.state.backward = pressed; break;
      case 'KeyA': this.state.left = pressed; break;
      case 'KeyD': this.state.right = pressed; break;
      case 'Space': this.state.reset = pressed; break;
    }
  }

  private onMouseDown = (e: MouseEvent): void => {
    switch (e.button) {
      case 0: this.state.mouseLeftDown = true; break;
      case 1: this.state.mouseMiddleDown = true; break;
      case 2: this.state.mouseRightDown = true; break;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    switch (e.button) {
      case 0: this.state.mouseLeftDown = false; break;
      case 1: this.state.mouseMiddleDown = false; break;
      case 2: this.state.mouseRightDown = false; break;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.state.mouseDeltaX += e.movementX;
    this.state.mouseDeltaY += e.movementY;
    this.state.mouseX = e.clientX;
    this.state.mouseY = e.clientY;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.state.scrollDelta += e.deltaY;
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  getState(): InputState {
    return { ...this.state };
  }

  // Reset deltas at end of frame
  resetDeltas(): void {
    this.state.mouseDeltaX = 0;
    this.state.mouseDeltaY = 0;
    this.state.scrollDelta = 0;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }
}
