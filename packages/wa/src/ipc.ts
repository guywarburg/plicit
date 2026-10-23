// Wire types shared between the listener (server) and any client that
// wants to send a WhatsApp message without owning the Baileys socket.

export interface SendMessageRequest {
  type: 'sendMessage';
  jid: string;
  text: string;
}

export interface StatusRequest {
  type: 'status';
}

export type IpcRequest = SendMessageRequest | StatusRequest;

export interface OkResponse<T = unknown> {
  ok: true;
  data: T;
}

export interface ErrResponse {
  ok: false;
  error: string;
}

export type IpcResponse<T = unknown> = OkResponse<T> | ErrResponse;

export interface ListenerStatus {
  connected: boolean;
  uptimeSeconds: number;
  lastMessageTs: number | null;
}
