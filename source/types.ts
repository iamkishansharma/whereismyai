export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeColor = 'default' | 'monochrome';

export interface DefaultStoreProps {
  showOnboarding: boolean;
  setShowOnboarding: (done: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus =
  | 'sending'
  | 'streaming'
  | 'sent'
  | 'stopped'
  | 'error';

export interface Attachment {
  id: string;
  messageId: string;
  kind: 'image';
  uri: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status: MessageStatus;
  error?: string;
  modelId?: string;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId?: string;
  systemPrompt?: string;
  messageIds: string[];
}

export interface ChatStoreProps {
  conversations: Record<string, Conversation>;
  conversationOrder: string[];
  messages: Record<string, Message>;

  activeConversationId?: string;
  hydrated: boolean;
  setActiveConversation: (conversationId?: string) => void;
  hydrate: () => Promise<void>;

  createConversation: (title?: string) => string;
  deleteConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;

  setConversationModel: (conversationId: string, modelId?: string) => void;

  sendMessage: (
    conversationId: string | undefined,
    text: string,
    files?: Attachment[],
  ) => string;
  stopStreaming: (conversationId: string) => void;

  appendToMessage: (messageId: string, chunk: string) => void;
  setMessageStatus: (
    messageId: string,
    status: MessageStatus,
    error?: string,
  ) => void;
}

export interface ModelFile {
  repo: string;
  filename: string;
  sizeBytes: number;
}

export interface ProjectorFile {
  filename: string;
  sizeBytes: number;
}

export interface CatalogModel extends ModelFile {
  id: string;
  name: string;
  publisher: string;
  params: string;
  quant: string;
  blurb: string;
  mmproj?: ProjectorFile;
}

export interface HfRepo {
  id: string;
  downloads: number;
  likes: number;
  tags: string[];
}

export interface ModelInfo {
  architecture?: string;
  paramCount?: number;
  contextLength?: number;
  quant?: string;
}

export interface InstalledModel extends ModelFile {
  id: string;
  name: string;
  path: string;
  downloadedAt: number;
  info?: ModelInfo;
  mmproj?: ProjectorFile;
  mmprojPath?: string;
}

export type DownloadStatus = 'queued' | 'downloading' | 'failed';

export interface DownloadTask {
  modelId: string;
  jobId?: number;
  bytesWritten: number;
  contentLength: number;
  status: DownloadStatus;
  error?: string;
}

export interface GenerationSettings {
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  nPredict: number;
  nCtx: number;
  nGpuLayers: number;
}

export type EngineState = 'idle' | 'loading' | 'ready' | 'error';

export interface ModelStoreProps {
  installed: Record<string, InstalledModel>;
  installedOrder: string[];
  selectedModelId?: string;
  downloads: Record<string, DownloadTask>;
  settingsByModel: Record<string, GenerationSettings>;

  engineState: EngineState;
  engineError?: string;
  loadProgress: number;
  visionActive: boolean;

  startDownload: (
    model: ModelFile & { id: string; name: string; mmproj?: ProjectorFile },
  ) => void;
  cancelDownload: (modelId: string) => void;
  deleteModel: (modelId: string) => Promise<void>;
  selectModel: (modelId?: string) => void;
  setModelInfo: (modelId: string, info: ModelInfo) => void;
  getModel: (modelId: string) => InstalledModel | undefined;
  getSelectedModel: () => InstalledModel | undefined;
  updateSettings: (modelId: string, patch: Partial<GenerationSettings>) => void;
  resetSettings: (modelId: string) => void;

  setEngineState: (state: EngineState, error?: string) => void;
  setVisionActive: (active: boolean) => void;
  setLoadProgress: (progress: number) => void;
  pruneMissingModels: () => Promise<void>;
}
