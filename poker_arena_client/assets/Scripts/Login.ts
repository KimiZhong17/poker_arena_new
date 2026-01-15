import { _decorator, Component, Node, Button, Label } from 'cc';
import { SceneManager } from './SceneManager';
import { AuthService } from './Services/AuthService';
import { LocalUserStore } from './LocalStore/LocalUserStore';

const { ccclass, property } = _decorator;

// 暴露调试函数到全局作用域
(window as any).clearPokerArenaCache = function() {
    LocalUserStore.clearAllCache();
    console.log('[Debug] Cache cleared, reloading page...');
    location.reload();
};

(window as any).getUserData = function() {
    const userData = LocalUserStore.getInstance().getUserData();
    console.log('[Debug] Current user data in memory:', userData);
    return userData;
};

/**
 * Login scene controller
 */
@ccclass('Login')
export class Login extends Component {
    @property(Button)
    guestButton: Button = null!;

    @property(Button)
    wechatButton: Button = null!;

    @property(Label)
    errorLabel: Label = null!;

    private authService: AuthService = null!;
    private sceneManager: SceneManager = null!;

    start() {
        this.authService = AuthService.getInstance();
        this.sceneManager = SceneManager.getInstance();

        // Check if already logged in
        if (this.authService.isLoggedIn()) {
            this.sceneManager.goToHall();
            return;
        }

        // Bind button events
        this.guestButton?.node.on(Button.EventType.CLICK, this.onGuestLoginButtonClicked, this);
        this.wechatButton?.node.on(Button.EventType.CLICK, this.onWeChatLoginButtonClicked, this);

        // Hide error label initially
        if (this.errorLabel) {
            this.errorLabel.node.active = false;
        }
    }

    onDestroy() {
        // Clean up event listeners with null checks
        if (this.guestButton?.node && this.guestButton.isValid) {
            this.guestButton.node.off(Button.EventType.CLICK, this.onGuestLoginButtonClicked, this);
        }
        if (this.wechatButton?.node && this.wechatButton.isValid) {
            this.wechatButton.node.off(Button.EventType.CLICK, this.onWeChatLoginButtonClicked, this);
        }
    }

    /**
     * Handle guest login button click
     * 注意：昵称输入面板由外部提供，这里预留接口
     */
    public async onGuestLoginButtonClicked() {
        console.log("Guest login button clicked.");

        if (this.guestButton) {
            this.guestButton.interactable = false;
        }

        try {
            // TODO: 这里应该弹出昵称输入面板，获取用户输入的昵称
            // 示例：const nickname = await this.showNicknameInputDialog();
            // 目前先使用undefined，会使用默认生成的昵称
            const nickname = undefined;

            const success = await this.authService.loginAsGuest(nickname);

            if (success) {
                this.sceneManager.goToHall();
            } else {
                this.showError('游客登录失败，请稍后重试');
            }
        } catch (error) {
            console.error('Guest login error:', error);
            this.showError('游客登录失败，请稍后重试');
        } finally {
            if (this.guestButton) {
                this.guestButton.interactable = true;
            }
        }
    }

    /**
     * Handle WeChat login button click
     */
    public onWeChatLoginButtonClicked(): void {
        console.log("WeChat login button clicked.");
        // TODO: Implement WeChat login
        this.showError('微信登录功能暂未实现');
    }

    /**
     * Show error message
     */
    private showError(message: string) {
        if (this.errorLabel) {
            this.errorLabel.string = message;
            this.errorLabel.node.active = true;

            // Hide after 3 seconds
            this.scheduleOnce(() => {
                if (this.errorLabel) {
                    this.errorLabel.node.active = false;
                }
            }, 3);
        }
    }
}

