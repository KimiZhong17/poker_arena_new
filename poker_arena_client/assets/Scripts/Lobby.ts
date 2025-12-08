import { _decorator, Component, director, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Lobby')
export class Lobby extends Component {
    public onCreateRoomButtonClicked(): void {
        console.log("Create room button clicked.");
        
        director.loadScene("Game", (err, scene) => {
            if (err) {
                console.error("Failed to load game scene:", err);
                return;
            }
            console.log("Game loaded successfully.");
        });
    }

    public onJoinGameButtonClicked(): void {
        console.log("Join game button clicked.");
    }

}
