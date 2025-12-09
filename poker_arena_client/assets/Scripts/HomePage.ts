import { _decorator, Component, Node, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HomePage')
export class HomePage extends Component {
    start() {

    }

    update(deltaTime: number) {
        
    }

    public onGuestLoginButtonClicked(): void {
        console.log("Guest login button clicked.");
        
        director.loadScene("Lobby", (err, scene) => {
            if (err) {
                console.error("Failed to load Lobby scene:", err);
                return;
            }
            console.log("Lobby loaded successfully.");
        });
    }

    public onWeChatLoginButtonClicked(): void {
        console.log("WeChat login button clicked.");
    }
}


