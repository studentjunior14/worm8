import { io, Socket } from "socket.io-client";

export class NetworkManager {
    private static instance: NetworkManager;
    public socket: Socket;

    private constructor() {
        // Default to localhost:3000 for development
        // In production, this would be the actual server URL
        const url = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
        this.socket = io(url);
    }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) NetworkManager.instance = new NetworkManager();
        return NetworkManager.instance;
    }

    public join(name: string, skin: string) {
        this.socket.emit('join', { name, skin });
    }

    public sendInput(angle: number, boosting: boolean) {
        this.socket.emit('input', { angle, boosting });
    }
}
