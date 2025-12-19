/**
 * Room state enumeration
 */
export enum RoomState {
    WAITING = "waiting",     // Waiting for players
    READY = "ready",         // All players ready
    PLAYING = "playing",     // Game in progress
    FINISHED = "finished"    // Game finished
}

/**
 * Room data structure
 */
export interface RoomData {
    id: string;
    name: string;
    gameModeId: string;
    state: RoomState;
    hostId: string;
    players: PlayerInfo[];
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
    createdAt: number;
}

/**
 * Room manager - handles room logic
 */
export class RoomManager {
    private static instance: RoomManager;
    private rooms: Map<string, RoomData> = new Map();
    private currentRoom: RoomData | null = null;

    private constructor() {}

    public static getInstance(): RoomManager {
        if (!RoomManager.instance) {
            RoomManager.instance = new RoomManager();
        }
        return RoomManager.instance;
    }

    public createRoom(config: {
        name?: string;
        roomName?: string;
        gameMode?: string;
        gameModeId?: string;
        maxPlayers: number;
        isPrivate?: boolean;
        isPublic?: boolean;
        password?: string;
    }): RoomData {
        const hostId = "local_player"; // TODO: Get from UserManager

        const roomData: RoomData = {
            id: this.generateRoomId(),
            name: config.name || config.roomName || "New Room",
            gameModeId: config.gameMode || config.gameModeId || "",
            state: RoomState.WAITING,
            hostId: hostId,
            players: [{
                id: hostId,
                name: "Player 1", // TODO: Get from UserManager
                isReady: false,
                isHost: true,
                seatIndex: 0
            }],
            maxPlayers: config.maxPlayers,
            isPrivate: config.isPrivate !== undefined ? config.isPrivate : !(config.isPublic ?? true),
            password: config.password,
            createdAt: Date.now()
        };

        this.rooms.set(roomData.id, roomData);
        this.currentRoom = roomData;

        return roomData;
    }

    public joinRoom(roomId: string, playerId: string, playerName: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) {
            return false;
        }

        if (room.players.length >= room.maxPlayers) {
            return false;
        }

        // Check if player already in room
        if (room.players.find(p => p.id === playerId)) {
            return true; // Already in room
        }

        room.players.push({
            id: playerId,
            name: playerName,
            isReady: false,
            isHost: false,
            seatIndex: room.players.length
        });

        this.currentRoom = room;
        return true;
    }

    public leaveRoom(roomId: string, playerId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;

        const index = room.players.findIndex(p => p.id === playerId);
        if (index === -1) return false;

        room.players.splice(index, 1);

        // If host left, assign new host
        if (room.hostId === playerId && room.players.length > 0) {
            room.players[0].isHost = true;
            room.hostId = room.players[0].id;
        }

        // If room is empty, delete it
        if (room.players.length === 0) {
            this.rooms.delete(roomId);
            if (this.currentRoom?.id === roomId) {
                this.currentRoom = null;
            }
        }

        return true;
    }

    public setPlayerReady(playerId: string, ready: boolean): boolean {
        if (!this.currentRoom) return false;

        const player = this.currentRoom.players.find(p => p.id === playerId);
        if (!player || player.isHost) return false; // Host can't set ready

        player.isReady = ready;

        // Check if all non-host players are ready
        this.checkRoomReady();

        return true;
    }

    public startGame(): boolean {
        if (!this.currentRoom) return false;
        if (this.currentRoom.state !== RoomState.READY) return false;

        this.currentRoom.state = RoomState.PLAYING;
        return true;
    }

    public getCurrentRoom(): RoomData | null {
        return this.currentRoom;
    }

    /**
     * Get room by ID
     */
    public getRoomById(roomId: string): RoomData | undefined {
        return this.rooms.get(roomId);
    }

    /**
     * Get all available rooms (public rooms)
     */
    public getAvailableRooms(): RoomData[] {
        return Array.from(this.rooms.values())
            .filter(room => !room.isPrivate && room.state === RoomState.WAITING);
    }

    /**
     * Get all rooms
     */
    public getAllRooms(): RoomData[] {
        return Array.from(this.rooms.values());
    }

    private checkRoomReady(): void {
        if (!this.currentRoom) return;

        const allReady = this.currentRoom.players
            .filter(p => !p.isHost)
            .every(p => p.isReady);

        if (allReady && this.currentRoom.players.length >= 2) {
            this.currentRoom.state = RoomState.READY;
        } else {
            this.currentRoom.state = RoomState.WAITING;
        }
    }

    private generateRoomId(): string {
        return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
