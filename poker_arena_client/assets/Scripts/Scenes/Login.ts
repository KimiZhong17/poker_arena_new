import { _decorator, Component, Node, Button, Label, EditBox } from 'cc';
import { SceneManager } from './SceneManager';
import { AuthService } from '../Services/AuthService';
import { LocalUserStore } from '../State/UserStore';
import { logger } from '../Utils/Logger';

const log = logger('Login');

const { ccclass, property } = _decorator;

// 暴露调试函数到全局作用域
(window as any).clearPokerArenaCache = function() {
    LocalUserStore.clearAllCache();
    log.debug('[Debug] Cache cleared, reloading page...');
    location.reload();
};

(window as any).getUserData = function() {
    const userData = LocalUserStore.getInstance().getUserData();
    log.debug('[Debug] Current user data in memory:', userData);
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

    @property(Node)
    nicknameInputPanel: Node = null!;

    private nicknameEditBox: EditBox = null!;
    private nicknameCloseButton: Button = null!;
    private nicknameConfirmButton: Button = null!;

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

        // 自动查找昵称输入面板中的子节点
        this.findNicknameInputComponents();

        // Bind button events
        this.guestButton?.node.on(Button.EventType.CLICK, this.onGuestLoginButtonClicked, this);
        this.wechatButton?.node.on(Button.EventType.CLICK, this.onWeChatLoginButtonClicked, this);
        this.nicknameCloseButton?.node.on(Button.EventType.CLICK, this.onNicknameCloseButtonClicked, this);
        this.nicknameConfirmButton?.node.on(Button.EventType.CLICK, this.onNicknameConfirmButtonClicked, this);

        // Hide error label initially
        if (this.errorLabel) {
            this.errorLabel.node.active = false;
        }

        // Hide nickname input panel initially
        if (this.nicknameInputPanel) {
            this.nicknameInputPanel.active = false;
        }
    }

    /**
     * 自动查找昵称输入面板中的组件
     */
    private findNicknameInputComponents() {
        if (!this.nicknameInputPanel) {
            log.warn('nicknameInputPanel not found');
            return;
        }

        // 查找 input_nick_name 节点及其 EditBox 组件
        const inputNode = this.nicknameInputPanel.getChildByName('input_nick_name');
        if (inputNode) {
            this.nicknameEditBox = inputNode.getComponent(EditBox);
            if (!this.nicknameEditBox) {
                log.warn('EditBox component not found on input_nick_name');
            }
        } else {
            log.warn('input_nick_name node not found');
        }

        // 查找 btn_close 节点及其 Button 组件
        const closeButtonNode = this.nicknameInputPanel.getChildByName('btn_close');
        if (closeButtonNode) {
            this.nicknameCloseButton = closeButtonNode.getComponent(Button);
            if (!this.nicknameCloseButton) {
                log.warn('Button component not found on btn_close');
            }
        } else {
            log.warn('btn_close node not found');
        }

        // 查找 btn_confirm 节点及其 Button 组件
        const confirmButtonNode = this.nicknameInputPanel.getChildByName('btn_confirm');
        if (confirmButtonNode) {
            this.nicknameConfirmButton = confirmButtonNode.getComponent(Button);
            if (!this.nicknameConfirmButton) {
                log.warn('Button component not found on btn_confirm');
            }
        } else {
            log.warn('btn_confirm node not found');
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
        if (this.nicknameCloseButton?.node && this.nicknameCloseButton.isValid) {
            this.nicknameCloseButton.node.off(Button.EventType.CLICK, this.onNicknameCloseButtonClicked, this);
        }
        if (this.nicknameConfirmButton?.node && this.nicknameConfirmButton.isValid) {
            this.nicknameConfirmButton.node.off(Button.EventType.CLICK, this.onNicknameConfirmButtonClicked, this);
        }
    }

    /**
     * Handle guest login button click
     * 显示昵称输入面板
     */
    public async onGuestLoginButtonClicked() {
        log.debug("Guest login button clicked.");

        // 显示昵称输入面板
        if (this.nicknameInputPanel) {
            this.nicknameInputPanel.active = true;

            // 清空输入框
            if (this.nicknameEditBox) {
                this.nicknameEditBox.string = '';
            }
        }
    }

    /**
     * Handle nickname close button click
     * 关闭昵称输入面板，不执行登录
     */
    public onNicknameCloseButtonClicked() {
        log.debug("Nickname close button clicked.");

        // 隐藏昵称输入面板
        if (this.nicknameInputPanel) {
            this.nicknameInputPanel.active = false;
        }

        // 清空输入框
        if (this.nicknameEditBox) {
            this.nicknameEditBox.string = '';
        }
    }

    /**
     * Handle nickname confirm button click
     * 确认昵称并执行登录
     */
    public async onNicknameConfirmButtonClicked() {
        log.debug("Nickname confirm button clicked.");

        // 获取用户输入的昵称
        const nickname = this.nicknameEditBox?.string?.trim();

        // 验证昵称
        if (nickname && nickname.length > 0) {
            if (nickname.length > 8) {
                this.showError('昵称不能超过8个字符');
                return;
            }
        }

        // 隐藏昵称输入面板
        if (this.nicknameInputPanel) {
            this.nicknameInputPanel.active = false;
        }

        // 禁用按钮
        if (this.guestButton) {
            this.guestButton.interactable = false;
        }

        try {
            // 使用用户输入的昵称登录，如果为空则使用默认昵称
            const nicknameToUse = nickname && nickname.length > 0 ? nickname : undefined;
            const success = await this.authService.loginAsGuest(nicknameToUse);

            if (success) {
                this.sceneManager.goToHall();
            } else {
                this.showError('游客登录失败，请稍后重试');
            }
        } catch (error) {
            log.error('Guest login error:', error);
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
        log.debug("WeChat login button clicked.");
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

