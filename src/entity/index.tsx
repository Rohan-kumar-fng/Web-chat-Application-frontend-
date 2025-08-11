export interface Message {
    id?: number;
    from: string;
    receiver?: string;
    content: string;
    sendTime?: string;
    receivedTime?: string;
    status?: MessageStatus;
    type?: MessageType;
}

export enum MessageStatus {
    JOIN = 'JOIN' ,
    LEAVE = 'LEAVE',
    MESSAGE = 'MESSAGE',
    TYPING = 'TYPING',
    ONLINE = 'ONLINE',
    OFFLINE = 'OFFLINE'
}

export enum MessageType {
    TEXT = 'TEXT',
    IMAGE = 'IMAGE',
    FILE = 'FILE',
    AUDIO = 'AUDIO',
    VIDEO = 'VIDEO'
}

export interface UserData {
    username: string;
    receivername: string;
    message: string;
    connected: boolean;
    status?: MessageStatus
}

export interface ChatRoom {
    name: string;
    type: 'PUBLIC' | 'PRIVATE';
    participants: string[];
    lastMessage: Message;
    unreadCount?: number;
}

export interface TypingIndicator {
    username: string;
    isTyping: boolean;
    chatRoom?: string;
}

export interface ConnectedStatus {
    connected: boolean;
    error?: string;
    reconnecting?: boolean;
}

// Websocket event types
export interface WebSocketEvents {
    onConnect: () => void;
    onDisconnected: () => void;
    onError: (error: Error) => void;
    onMessage: (message: Message) => void;
    onTyping: (typing: TypingIndicator) => void;
    onUserStatusChange: (username: string, status: MessageStatus) => void;
}