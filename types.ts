export enum AppMode {
  HOME = 'HOME',
  LIVE = 'LIVE',
  CHAT = 'CHAT',
  STUDIO = 'STUDIO',
}

export enum StudioTool {
  IMAGE_GEN = 'IMAGE_GEN',
  VIDEO_GEN = 'VIDEO_GEN',
  IMAGE_EDIT = 'IMAGE_EDIT',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}

export interface GenerationResult {
  type: 'image' | 'video' | 'text';
  url?: string;
  text?: string;
  loading: boolean;
  error?: string;
}
