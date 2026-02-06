import { _decorator, Component, Node, Button, EventHandler } from 'cc';
import { Game } from '../Game';
import { LocalRoomStore } from '../LocalStore/LocalRoomStore';
import { LocalGameStore } from '../LocalStore/LocalGameStore';
import { ClientMessageType } from '../Network/Messages';
import { Switch } from './Switch';
import { MessageTip } from './MessageTip';
const { ccclass, property } = _decorator;

/**
 * The Decree UI Controller
 * Manages all UI interactions for The Decree game mode
 *
 * Usage:
 * 1. Attach this component to TheDecree
 * 2. UI buttons will be automatically found by name, or you can manually assign them in the editor
 */
@ccclass('TheDecreeUIController')
export class TheDecreeUIController extends Component {

    // Option 1: Manually assign in editor (recommended for important buttons)
    @property(Button)
    public playButton: Button | null = null;

    @property(Node)
    public btnCall123Node: Node | null = null;

    @property(Switch)
    public autoPlaySwitch: Switch | null = null;

    @property(MessageTip)
    public messageTip: MessageTip | null = null;

    // Auto-found references (don't need to assign in editor)
    private callOneButton: Button | null = null;
    private callTwoButton: Button | null = null;
    private callThreeButton: Button | null = null;

    // Temporarily unused - uncomment when needed
    // @property(Button)
    // public clearSelectionButton: Button | null = null;

    // @property(Label)
    // public statusLabel: Label | null = null;

    // Private
    private _game: Game = null!;
    private _selectedCardIndices: number[] = [];
    private _hasSubmittedFirstDealerSelection: boolean = false; // 防止重复提交首庄选择

    onLoad() {
        // Find Game component
        this._game = this.findGameComponent();

        if (!this._game) {
            console.error('[TheDecreeUI] Game component not found!');
            return;
        }

        // Option 2: Auto-find buttons by name (if not manually assigned)
        this.autoFindUIElements();

        // Register button events
        this.registerButtonEvents();

        // Initialize UI state
        this.updateUIState();

        // Hide call buttons initially
        this.hideCallButtons();
        console.log('[TheDecreeUI] Call buttons hidden on load');
    }

    start() {
        // Initialize button visibility
        this.updateCallButtonsVisibility();

        // Initialize auto-play switch state
        // 延迟初始化，等待 LocalGameStore 从服务器同步数据
        this.scheduleOnce(() => {
            if (this.autoPlaySwitch) {
                const myId = LocalGameStore.getInstance().getMyPlayerId();
                const isEnabled = LocalGameStore.getInstance().isPlayerAuto(myId);

                console.log('[TheDecreeUI] Initializing auto-play switch...');
                console.log('[TheDecreeUI] My player ID:', myId);
                console.log('[TheDecreeUI] LocalGameStore isAuto:', isEnabled);

                // 直接使用服务器同步的状态，不做任何修改
                // 如果用户想要默认开启，应该在服务器端设置默认值
                this.autoPlaySwitch.setValue(isEnabled, true); // silent = true，不触发回调
                console.log('[TheDecreeUI] Auto-play switch initialized to:', isEnabled);
            }

            // Register Switch event AFTER initialization
            this.registerSwitchEvent();
        }, 0.2);
    }

    /**
     * Update call buttons visibility based on dealer status
     * Only show when player_0 is the dealer and in DEALER_CALL state
     */
    public updateCallButtonsVisibility(): void {
        console.log('[TheDecreeUI] updateCallButtonsVisibility() called');
        console.log('[TheDecreeUI]   _game:', !!this._game);

        if (!this._game) {
            console.log('[TheDecreeUI]   Game not ready, hiding buttons');
            this.hideCallButtons();
            return;
        }

        // 从 StageManager 获取当前 PlayingStage，然后获取 GameMode
        const playingStage = this._game.stageManager?.getCurrentStage();
        const theDecreeMode = playingStage ? (playingStage as any).getCurrentGameMode() : null;

        console.log('[TheDecreeUI]   playingStage:', !!playingStage);
        console.log('[TheDecreeUI]   theDecreeMode:', !!theDecreeMode);

        if (!theDecreeMode) {
            console.log('[TheDecreeUI]   Mode not ready, hiding buttons');
            this.hideCallButtons();
            return;
        }

        const dealerId = theDecreeMode.getDealerId();
        console.log('[TheDecreeUI]   dealerId:', dealerId);

        // 获取当前玩家ID
        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();

        console.log('[TheDecreeUI]   currentPlayerId:', currentPlayerId);

        // Show buttons only when current player is the dealer
        const shouldShow = dealerId && currentPlayerId === dealerId;

        console.log('[TheDecreeUI]   shouldShow:', shouldShow);

        if (shouldShow) {
            this.showCallButtons();
            console.log('[TheDecreeUI] Showing call buttons - current player is the dealer');
        } else {
            this.hideCallButtons();
        }
    }

    /**
     * Find Game component in the scene
     */
    private findGameComponent(): Game {
        // Try to find in parent nodes
        let node = this.node.parent;
        while (node) {
            const game = node.getComponent(Game);
            if (game) {
                return game;
            }
            node = node.parent;
        }

        console.error('[TheDecreeUI] Could not find Game component');
        return null!;
    }

    /**
     * Auto-find UI elements by name (if not manually assigned)
     */
    private autoFindUIElements(): void {
        console.log('[TheDecreeUI] Auto-finding UI elements...');
        console.log('[TheDecreeUI] this.node:', this.node?.name);

        // Find play button
        if (!this.playButton) {
            const playButtonNode = this.node.getChildByName('PlayButton');
            this.playButton = playButtonNode?.getComponent(Button) || null;
            console.log('[TheDecreeUI] PlayButton search result:', !!this.playButton);
        }

        // Auto-find auto-play switch
        if (!this.autoPlaySwitch) {
            const switchNode = this.node.getChildByName('switch_auto');
            this.autoPlaySwitch = switchNode?.getComponent(Switch) || null;
            console.log('[TheDecreeUI] AutoPlaySwitch search result:', !!this.autoPlaySwitch);
        }

        // Auto-find message tip
        if (!this.messageTip) {
            const messageTipNode = this.node.getChildByName('MessageTip');
            this.messageTip = messageTipNode?.getComponent(MessageTip) || null;
            console.log('[TheDecreeUI] MessageTip search result:', !!this.messageTip);
        }

        // Auto-find Btn_Call123 container node if not assigned
        console.log('[TheDecreeUI] Looking for Btn_Call123 container...');
        if (!this.btnCall123Node) {
            this.btnCall123Node = this.node.getChildByName('Btn_Call123');
            console.log('[TheDecreeUI] Btn_Call123 found:', !!this.btnCall123Node);
        } else {
            console.log('[TheDecreeUI] Btn_Call123 already assigned:', !!this.btnCall123Node);
        }

        // Auto-find call buttons from Btn_Call123 container
        if (this.btnCall123Node) {
            console.log('[TheDecreeUI] Searching for call buttons inside Btn_Call123...');
            console.log('[TheDecreeUI] Btn_Call123 children count:', this.btnCall123Node.children.length);
            console.log('[TheDecreeUI] Btn_Call123 children names:', this.btnCall123Node.children.map(c => c.name).join(', '));

            // Find buttons inside the container
            const callOneNode = this.btnCall123Node.getChildByName('btn_call1');
            this.callOneButton = callOneNode?.getComponent(Button) || null;
            console.log('[TheDecreeUI] CallOneButton search result:', !!this.callOneButton, 'node found:', !!callOneNode);

            const callTwoNode = this.btnCall123Node.getChildByName('btn_call2');
            this.callTwoButton = callTwoNode?.getComponent(Button) || null;
            console.log('[TheDecreeUI] CallTwoButton search result:', !!this.callTwoButton, 'node found:', !!callTwoNode);

            const callThreeNode = this.btnCall123Node.getChildByName('btn_call3');
            this.callThreeButton = callThreeNode?.getComponent(Button) || null;
            console.log('[TheDecreeUI] CallThreeButton search result:', !!this.callThreeButton, 'node found:', !!callThreeNode);
        } else {
            console.log('[TheDecreeUI] Btn_Call123 not found, trying to find buttons at root level...');
            // Fallback: try to find call buttons at root level
            const callOneNode = this.node.getChildByName('btn_call1');
            this.callOneButton = callOneNode?.getComponent(Button) || null;
            console.log('[TheDecreeUI] CallOneButton (root) search result:', !!this.callOneButton);

            const callTwoNode = this.node.getChildByName('btn_call2');
            this.callTwoButton = callTwoNode?.getComponent(Button) || null;
            console.log('[TheDecreeUI] CallTwoButton (root) search result:', !!this.callTwoButton);

            const callThreeNode = this.node.getChildByName('btn_call3');
            this.callThreeButton = callThreeNode?.getComponent(Button) || null;
            console.log('[TheDecreeUI] CallThreeButton (root) search result:', !!this.callThreeButton);
        }

        // Temporarily disabled
        // if (!this.clearSelectionButton) {
        //     const clearNode = this.node.getChildByName('ClearSelectionButton');
        //     this.clearSelectionButton = clearNode?.getComponent(Button) || null;
        // }

        // if (!this.statusLabel) {
        //     const labelNode = this.node.getChildByName('StatusLabel');
        //     this.statusLabel = labelNode?.getComponent(Label) || null;
        // }

        console.log('[TheDecreeUI] UI elements found:', {
            playButton: !!this.playButton,
            autoPlaySwitch: !!this.autoPlaySwitch,
            btnCall123Node: !!this.btnCall123Node,
            callOneButton: !!this.callOneButton,
            callTwoButton: !!this.callTwoButton,
            callThreeButton: !!this.callThreeButton,
            // clearSelectionButton: !!this.clearSelectionButton,
            // statusLabel: !!this.statusLabel
        });
    }

    /**
     * Register button click events
     */
    private registerButtonEvents(): void {
        console.log('[TheDecreeUI] Registering button events...');

        if (this.playButton) {
            this.playButton.node.on(Button.EventType.CLICK, this.onPlayButtonClicked, this);
            console.log('[TheDecreeUI] ✓ Play button event registered');
        } else {
            console.warn('[TheDecreeUI] ✗ Play button not found');
        }

        // 注意：Switch 事件在 start() 之后注册，避免初始化时触发
        // 这里不注册 Switch 事件

        if (this.callOneButton) {
            this.callOneButton.node.on(Button.EventType.CLICK, () => this.onCallButtonClicked(1), this);
            console.log('[TheDecreeUI] ✓ Call ONE button event registered');
        } else {
            console.warn('[TheDecreeUI] ✗ Call ONE button not found');
        }

        if (this.callTwoButton) {
            this.callTwoButton.node.on(Button.EventType.CLICK, () => this.onCallButtonClicked(2), this);
            console.log('[TheDecreeUI] ✓ Call TWO button event registered');
        } else {
            console.warn('[TheDecreeUI] ✗ Call TWO button not found');
        }

        if (this.callThreeButton) {
            this.callThreeButton.node.on(Button.EventType.CLICK, () => this.onCallButtonClicked(3), this);
            console.log('[TheDecreeUI] ✓ Call THREE button event registered');
        } else {
            console.warn('[TheDecreeUI] ✗ Call THREE button not found');
        }

        console.log('[TheDecreeUI] Button event registration complete');

        // Temporarily disabled
        // if (this.clearSelectionButton) {
        //     this.clearSelectionButton.node.on(Button.EventType.CLICK, this.onClearSelectionClicked, this);
        // }
    }

    /**
     * Register Switch event after initialization
     * Called in start() after setValue()
     */
    private registerSwitchEvent(): void {
        if (this.autoPlaySwitch) {
            // 通过代码直接注册事件（更可靠）
            // 创建 EventHandler 并添加到 Switch 的 onValueChanged 数组
            const handler = new EventHandler();
            handler.target = this.node;
            handler.component = 'TheDecreeUIController';
            handler.handler = 'onAutoPlaySwitchChanged';
            handler.customEventData = '';

            this.autoPlaySwitch.onValueChanged.push(handler);

            console.log('[TheDecreeUI] ✓ Auto-play switch event registered via code');
        }
    }

    /**
     * Enable card selection for player 0
     * Can be called externally by TheDecreeMode
     */
    public enableCardSelection(): void {
        console.log('[TheDecreeUI] enableCardSelection() called');

        if (!this._game) {
            console.error('[TheDecreeUI] Cannot enable card selection - game not found');
            return;
        }

        // 从 StageManager 获取 PlayerUIManager
        const playerUIManager = this._game.playerUIManager;
        console.log('[TheDecreeUI] playerUIManager:', !!playerUIManager);

        if (!playerUIManager) {
            console.error('[TheDecreeUI] Cannot enable card selection - PlayerUIManager not found');
            return;
        }

        // 启用玩家0的卡牌选择
        playerUIManager.enableCardSelection(0, (selectedIndices: number[]) => {
            this._selectedCardIndices = selectedIndices;
            this.onSelectionChanged(selectedIndices);
        });

        console.log('[TheDecreeUI] ✓ Card selection enabled for player 0');
    }

    /**
     * Handle card selection changes
     */
    private onSelectionChanged(selectedIndices: number[]): void {
        console.log(`[TheDecreeUI] Selected cards: [${selectedIndices.join(', ')}]`);

        // Update UI based on selection
        this.updateUIState();

        // Temporarily disabled - status label update
        // if (this.statusLabel) {
        //     if (selectedIndices.length > 0) {
        //         this.statusLabel.string = `已选择 ${selectedIndices.length} 张牌`;
        //     } else {
        //         this.statusLabel.string = '请选择牌';
        //     }
        // }
    }

    /**
     * Update UI state (enable/disable buttons)
     * Controls play button based on:
     * 1. Whether cards are selected
     * 2. Whether the number of selected cards matches dealer's requirement
     * 3. Whether the game is in the correct phase
     */
    public updateUIState(): void {
        if (!this.playButton) {
            return;
        }

        // Check if we have a game and game mode
        if (!this._game) {
            this.playButton.interactable = false;
            return;
        }

        const playingStage = this._game.stageManager?.getCurrentStage();
        const theDecreeMode = playingStage ? (playingStage as any).getCurrentGameMode() : null;

        if (!theDecreeMode) {
            // No game mode - disable play button
            this.playButton.interactable = false;
            return;
        }

        // Get the required number of cards to play (set by dealer)
        const cardsToPlay = theDecreeMode.getCardsToPlay();
        const gameState = theDecreeMode.getState();
        console.log(`[TheDecreeUI] updateUIState - gameState: ${gameState}, cardsToPlay: ${cardsToPlay}, selected: ${this._selectedCardIndices.length}`);

        // Enable play button based on game state:
        // 1. First dealer selection (gameState === 'first_dealer'): enable if exactly 1 card selected
        // 2. Normal play (cardsToPlay > 0): enable if selected cards match dealer's requirement
        let hasValidSelection = false;

        if (gameState === 'first_dealer') {
            // First dealer selection: need exactly 1 card
            hasValidSelection = this._selectedCardIndices.length === 1;
        } else {
            // Normal play: need to match dealer's requirement
            hasValidSelection = cardsToPlay > 0 &&
                              this._selectedCardIndices.length > 0 &&
                              this._selectedCardIndices.length === cardsToPlay;
        }

        this.playButton.interactable = hasValidSelection;

        if (hasValidSelection) {
            console.log(`[TheDecreeUI] ✓ Play button enabled (${this._selectedCardIndices.length} cards selected)`);
        } else if (gameState === 'first_dealer') {
            console.log(`[TheDecreeUI] ✗ Play button disabled (first dealer selection: need exactly 1 card, selected ${this._selectedCardIndices.length})`);
        } else if (cardsToPlay === 0) {
            console.log(`[TheDecreeUI] ✗ Play button disabled (dealer hasn't called yet)`);
        } else if (this._selectedCardIndices.length === 0) {
            console.log(`[TheDecreeUI] ✗ Play button disabled (no cards selected)`);
        } else {
            console.log(`[TheDecreeUI] ✗ Play button disabled (need ${cardsToPlay} cards, selected ${this._selectedCardIndices.length})`);
        }
    }

    // ==================== Button Event Handlers ====================

    /**
     * Handle "Play" button clicked
     * 处理两种情况：
     * 1. 首庄选择阶段（gameState === 'first_dealer'）：确认选择首庄的牌
     * 2. 正常出牌阶段（gameState === 'player_selection'）：出牌
     */
    private onPlayButtonClicked(): void {
        console.log('[TheDecreeUI] ========== Play Button Clicked ==========');
        console.log('[TheDecreeUI] Selected card indices:', this._selectedCardIndices);

        if (this._selectedCardIndices.length === 0) {
            console.warn('[TheDecreeUI] No cards selected');
            return;
        }

        if (!this._game) {
            console.error('[TheDecreeUI] Game not found!');
            return;
        }

        // Get the current game mode from StageManager
        const playingStage = this._game.stageManager?.getCurrentStage();
        const theDecreeMode = playingStage ? (playingStage as any).getCurrentGameMode() : null;

        if (!theDecreeMode) {
            console.error('[TheDecreeUI] TheDecreeMode not found!');
            return;
        }

        const gameState = theDecreeMode.getState();
        const cardsToPlay = theDecreeMode.getCardsToPlay();
        console.log('[TheDecreeUI] gameState:', gameState);
        console.log('[TheDecreeUI] cardsToPlay:', cardsToPlay);
        console.log('[TheDecreeUI] Player selected:', this._selectedCardIndices.length, 'cards');

        // Get player's hand cards from PlayerUIManager
        const playerUIManager = this._game.playerUIManager;
        if (!playerUIManager) {
            console.error('[TheDecreeUI] PlayerUIManager not found!');
            return;
        }

        // Get the player's hand cards (player index 0)
        const playerUINode = playerUIManager.getPlayerUINode(0);
        if (!playerUINode) {
            console.error('[TheDecreeUI] PlayerUINode not found for index 0');
            return;
        }

        const player = playerUINode.getPlayer();
        if (!player) {
            console.error('[TheDecreeUI] Player data not found');
            return;
        }

        const handCards = player.handCards;
        console.log('[TheDecreeUI] Player hand cards:', handCards);
        console.log('[TheDecreeUI] Player hand cards (hex):', handCards.map(c => '0x' + c.toString(16)));

        // Convert selected indices to actual card values
        const selectedCards = this._selectedCardIndices
            .map(index => {
                const card = handCards[index];
                console.log(`[TheDecreeUI] Index ${index} -> Card 0x${card ? card.toString(16) : 'undefined'}`);
                return card;
            })
            .filter(card => card !== undefined);

        console.log('[TheDecreeUI] Selected cards:', selectedCards);
        console.log('[TheDecreeUI] Selected cards (hex):', selectedCards.map(c => '0x' + c.toString(16)));

        if (selectedCards.length !== this._selectedCardIndices.length) {
            console.error('[TheDecreeUI] Some selected indices are invalid');
            return;
        }

        // Get current player ID from LocalRoomStore
        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();

        // 判断当前阶段
        if (gameState === 'first_dealer') {
            // ========== 首庄选择阶段 ==========
            console.log('[TheDecreeUI] First dealer selection phase');

            // 检查是否已经提交过
            if (this._hasSubmittedFirstDealerSelection) {
                console.warn('[TheDecreeUI] ✗ Already submitted first dealer selection, ignoring duplicate request');
                return;
            }

            // 只能选择一张牌
            if (this._selectedCardIndices.length !== 1) {
                console.error(`[TheDecreeUI] Must select exactly 1 card for first dealer selection! Selected: ${this._selectedCardIndices.length}`);
                return;
            }

            const selectedCard = selectedCards[0];
            console.log('[TheDecreeUI] Selected card for first dealer:', '0x' + selectedCard.toString(16));

            // 发送到服务器
            if (this._game.networkClient) {
                this._game.networkClient.send(ClientMessageType.SELECT_FIRST_DEALER_CARD, {
                    roomId: localRoomStore.getCurrentRoom()?.id,
                    playerId: currentPlayerId,
                    card: selectedCard
                });
                console.log('[TheDecreeUI] ✓ First dealer card selection sent to server');

                // 标记已提交，防止重复发送
                this._hasSubmittedFirstDealerSelection = true;
            }

            // 锁定未选中的牌（变暗），保持选中的牌高亮
            playerUIManager.lockUnselectedCards(0);

            // 禁用出牌按钮
            if (this.playButton) {
                this.playButton.interactable = false;
                console.log('[TheDecreeUI] Play button disabled after first dealer selection');
            }

            console.log('[TheDecreeUI] ⏳ 等待其他玩家选择...');

        } else {
            // ========== 正常出牌阶段 ==========
            console.log('[TheDecreeUI] Normal play phase');
            console.log('[TheDecreeUI] Dealer requires:', cardsToPlay, 'cards');

            if (cardsToPlay === 0) {
                console.error('[TheDecreeUI] Cannot play - dealer has not called yet');
                return;
            }

            // 验证选择的牌数是否匹配
            if (this._selectedCardIndices.length !== cardsToPlay) {
                console.error(`[TheDecreeUI] Invalid number of cards selected! Need ${cardsToPlay}, selected ${this._selectedCardIndices.length}`);
                return;
            }

            // Call TheDecreeMode's playCards method (which will send to server)
            const success = theDecreeMode.playCards(selectedCards, currentPlayerId);
            console.log('[TheDecreeUI] playCards result:', success);

            if (success) {
                console.log('[TheDecreeUI] ✓ Play cards request sent successfully');

                // Lock unselected cards (dim them and disable interaction)
                // Don't clear selection - we want to keep selected cards visible
                playerUIManager.lockUnselectedCards(0);

                // Disable play button after playing (player cannot play again)
                if (this.playButton) {
                    this.playButton.interactable = false;
                    console.log('[TheDecreeUI] Play button disabled after playing cards');
                }
            } else {
                console.error('[TheDecreeUI] ✗ Failed to send play cards request');
            }
        }

        console.log('[TheDecreeUI] =====================================');
    }

    /**
     * Handle "Call" button clicked (dealer calls how many cards to play)
     * @param cardsCount Number of cards (1, 2, or 3)
     */
    private onCallButtonClicked(cardsCount: 1 | 2 | 3): void {
        console.log('[TheDecreeUI] ========== Call Button Clicked ==========');
        console.log(`[TheDecreeUI] Call ${cardsCount} button clicked`);
        console.log('[TheDecreeUI] _game:', !!this._game);

        if (!this._game) {
            console.error('[TheDecreeUI] Game not found!');
            return;
        }

        // Get TheDecreeModeClient from PlayingStage
        const playingStage = this._game.stageManager?.getCurrentStage();
        const theDecreeMode = playingStage ? (playingStage as any).getCurrentGameMode() : null;

        console.log('[TheDecreeUI] playingStage:', !!playingStage);
        console.log('[TheDecreeUI] theDecreeMode:', !!theDecreeMode);

        if (!theDecreeMode) {
            console.error('[TheDecreeUI] TheDecreeModeClient not found!');
            return;
        }

        console.log('[TheDecreeUI] Calling dealerCall method on TheDecreeModeClient...');
        const success = theDecreeMode.dealerCall(cardsCount);
        console.log('[TheDecreeUI] dealerCall result:', success);

        if (success) {
            console.log(`[TheDecreeUI] ✓ Dealer called: ${cardsCount} cards`);
            // this.updateStatusLabel(`庄家叫牌：${cardsCount}张`, 'success');

            // Hide call buttons immediately after calling
            console.log('[TheDecreeUI] Hiding call buttons...');
            this.hideCallButtons();

            // Enable card selection for all players
            console.log('[TheDecreeUI] Enabling card selection...');
            this.enableCardSelection();
        } else {
            console.error(`[TheDecreeUI] ✗ Failed to call ${cardsCount} cards`);
            // this.updateStatusLabel('叫牌失败！', 'error');
        }

        console.log('[TheDecreeUI] =====================================');
    }

    /**
     * Handle auto-play switch value changed
     * This method should be configured in the editor as the onValueChanged callback
     *
     * @param event - The Switch component that triggered the event
     * @param customEventData - Custom data from editor (optional)
     */
    public onAutoPlaySwitchChanged(event: Switch, customEventData?: string): void {
        console.log('[TheDecreeUI] onAutoPlaySwitchChanged called');
        console.log('[TheDecreeUI] event:', event);
        console.log('[TheDecreeUI] customEventData:', customEventData);

        if (!this._game || !this._game.theDecreeMode) {
            console.error('[TheDecreeUI] Cannot toggle auto-play - game not ready');
            return;
        }

        // event 参数是 Switch 组件本身
        const isOn = event ? event.getValue() : false;
        console.log('[TheDecreeUI] Switch value:', isOn);

        const theDecreeMode = this._game.theDecreeMode;

        // 调用 setAuto() 发送到服务器，而不是只设置本地状态
        theDecreeMode.setAuto(isOn);

        console.log(`[TheDecreeUI] Auto-play switched to: ${isOn ? 'ON' : 'OFF'}`);
    }

    // Temporarily disabled - Clear Selection button handler
    /**
     * Handle "Clear Selection" button clicked
     */
    // private onClearSelectionClicked(): void {
    //     console.log('[TheDecreeUI] Clear selection button clicked');
    //
    //     this._game.handsManager.clearSelection(0);
    //     this._selectedCardIndices = [];
    //     this.updateUIState();
    //
    //     this.updateStatusLabel('已清除选择', 'info');
    // }

    // ==================== Helper Methods ====================

    // Temporarily disabled - Status Label update method
    /**
     * Update status label
     */
    // private updateStatusLabel(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    //     if (!this.statusLabel) return;
    //
    //     this.statusLabel.string = message;
    //
    //     // You can change color based on type
    //     // For example:
    //     // switch (type) {
    //     //     case 'success': this.statusLabel.color = Color.GREEN; break;
    //     //     case 'error': this.statusLabel.color = Color.RED; break;
    //     //     case 'warning': this.statusLabel.color = Color.YELLOW; break;
    //     //     default: this.statusLabel.color = Color.WHITE; break;
    //     // }
    // }

    /**
     * Hide call buttons (after dealer has called)
     */
    private hideCallButtons(): void {
        console.log('[TheDecreeUI] hideCallButtons() called, btnCall123Node:', !!this.btnCall123Node);

        if (this.btnCall123Node) {
            this.btnCall123Node.active = false;
            console.log('[TheDecreeUI] Set btnCall123Node.active = false');
        } else {
            // Fallback: hide individual buttons if container not found
            console.log('[TheDecreeUI] No container found, hiding individual buttons');
            if (this.callOneButton) {
                this.callOneButton.node.active = false;
                console.log('[TheDecreeUI] Set callOneButton.active = false');
            }
            if (this.callTwoButton) {
                this.callTwoButton.node.active = false;
                console.log('[TheDecreeUI] Set callTwoButton.active = false');
            }
            if (this.callThreeButton) {
                this.callThreeButton.node.active = false;
                console.log('[TheDecreeUI] Set callThreeButton.active = false');
            }
        }
    }

    /**
     * Show call buttons (when starting new round)
     * Also disables buttons based on remaining hand cards
     */
    private showCallButtons(): void {
        console.log('[TheDecreeUI] showCallButtons() called, btnCall123Node:', !!this.btnCall123Node);

        // Get player's hand card count - prefer displayed cards over player.handCards
        // because player.handCards may not be updated yet during refill animation
        let handCardCount = 0;
        if (this._game && this._game.playerUIManager) {
            const playerUINode = this._game.playerUIManager.getPlayerUINode(0);
            if (playerUINode) {
                // Try to get count from hand display first (more accurate during animations)
                const handDisplay = playerUINode.getHandDisplay();
                if (handDisplay && typeof handDisplay.getDisplayedCardValues === 'function') {
                    const displayedCards = handDisplay.getDisplayedCardValues();
                    handCardCount = displayedCards.length;
                    console.log('[TheDecreeUI] Using displayed card count:', handCardCount);
                } else {
                    // Fallback to player.handCards
                    const player = playerUINode.getPlayer();
                    if (player && player.handCards) {
                        handCardCount = player.handCards.length;
                        console.log('[TheDecreeUI] Using player.handCards count:', handCardCount);
                    }
                }
            }
        }

        // TheDecree mode always has 5 cards after refill, so default to 5 if we can't determine
        if (handCardCount === 0) {
            handCardCount = 5;
            console.log('[TheDecreeUI] Defaulting to 5 cards');
        }

        if (this.btnCall123Node) {
            this.btnCall123Node.active = true;
            console.log('[TheDecreeUI] Set btnCall123Node.active = true');
        } else {
            // Fallback: show individual buttons if container not found
            console.log('[TheDecreeUI] No container found, showing individual buttons');
            if (this.callOneButton) {
                this.callOneButton.node.active = true;
                console.log('[TheDecreeUI] Set callOneButton.active = true');
            }
            if (this.callTwoButton) {
                this.callTwoButton.node.active = true;
                console.log('[TheDecreeUI] Set callTwoButton.active = true');
            }
            if (this.callThreeButton) {
                this.callThreeButton.node.active = true;
                console.log('[TheDecreeUI] Set callThreeButton.active = true');
            }
        }

        // Disable buttons based on hand card count
        // If hand cards < 2, disable call2 and call3
        // If hand cards < 3, disable call3
        if (this.callTwoButton) {
            const shouldDisable = handCardCount < 2;
            this.callTwoButton.interactable = !shouldDisable;
            console.log(`[TheDecreeUI] Call2 button ${shouldDisable ? 'disabled' : 'enabled'} (hand cards: ${handCardCount})`);
        }

        if (this.callThreeButton) {
            const shouldDisable = handCardCount < 3;
            this.callThreeButton.interactable = !shouldDisable;
            console.log(`[TheDecreeUI] Call3 button ${shouldDisable ? 'disabled' : 'enabled'} (hand cards: ${handCardCount})`);
        }

        // Call1 is always enabled (as long as player has at least 1 card)
        if (this.callOneButton) {
            this.callOneButton.interactable = handCardCount >= 1;
            console.log(`[TheDecreeUI] Call1 button ${handCardCount >= 1 ? 'enabled' : 'disabled'} (hand cards: ${handCardCount})`);
        }
    }

    /**
     * Disable all UI interactions
     */
    public disableAllButtons(): void {
        if (this.playButton) this.playButton.interactable = false;
        if (this.callOneButton) this.callOneButton.interactable = false;
        if (this.callTwoButton) this.callTwoButton.interactable = false;
        if (this.callThreeButton) this.callThreeButton.interactable = false;
        // if (this.clearSelectionButton) this.clearSelectionButton.interactable = false;

        // Disable card selection
        this._game?.handsManager?.disableCardSelection(0);
    }

    /**
     * Enable all UI interactions
     */
    public enableAllButtons(): void {
        this.updateUIState(); // This will properly enable/disable based on state
    }

    /**
     * Show a message tip to the user
     * @param message The message to display
     * @param duration Display duration in seconds (0 = use default)
     */
    public showMessage(message: string, duration: number = 0): void {
        if (this.messageTip) {
            this.messageTip.showMessage(message, duration);
            console.log(`[TheDecreeUI] Showing message: "${message}"`);
        } else {
            console.warn('[TheDecreeUI] MessageTip not found, cannot show message');
        }
    }

    /**
     * Clean up
     */
    onDestroy() {
        // Unregister events with null checks
        if (this.playButton && this.playButton.node) {
            this.playButton.node.off(Button.EventType.CLICK, this.onPlayButtonClicked, this);
        }

        if (this.callOneButton && this.callOneButton.node) {
            this.callOneButton.node.off(Button.EventType.CLICK);
        }
        if (this.callTwoButton && this.callTwoButton.node) {
            this.callTwoButton.node.off(Button.EventType.CLICK);
        }
        if (this.callThreeButton && this.callThreeButton.node) {
            this.callThreeButton.node.off(Button.EventType.CLICK);
        }

        // Switch 组件会自己清理事件
    }

    /**
     * Reset UI state for game restart
     * Call this when returning to ReadyStage
     */
    public resetForRestart(): void {
        console.log('[TheDecreeUI] ========================================');
        console.log('[TheDecreeUI] resetForRestart() called');
        console.log('[TheDecreeUI] Before reset: _hasSubmittedFirstDealerSelection =', this._hasSubmittedFirstDealerSelection);
        console.log('[TheDecreeUI] Before reset: _selectedCardIndices =', this._selectedCardIndices);

        // Reset first dealer selection flag
        this._hasSubmittedFirstDealerSelection = false;

        // Clear selected cards
        this._selectedCardIndices = [];

        // Hide call buttons
        this.hideCallButtons();

        // 隐藏消息提示（防止再来一局时看到上一局的胜者弹窗）
        if (this.messageTip) {
            this.messageTip.hide();
            console.log('[TheDecreeUI] MessageTip hidden');
        }

        // 重置托管开关状态（但保持可见，因为游戏开始时需要显示）
        if (this.autoPlaySwitch) {
            this.autoPlaySwitch.setValue(false, true); // silent = true，不触发回调
            // 不隐藏托管开关，让它在游戏开始时自然显示
            console.log('[TheDecreeUI] Auto-play switch reset to false');
        }

        // 不调用 updateUIState()，因为在 ReadyStage 时游戏模式还没有初始化
        // updateUIState() 会在游戏开始时自动调用

        console.log('[TheDecreeUI] After reset: _hasSubmittedFirstDealerSelection =', this._hasSubmittedFirstDealerSelection);
        console.log('[TheDecreeUI] After reset: _selectedCardIndices =', this._selectedCardIndices);
        console.log('[TheDecreeUI] UI state reset complete');
        console.log('[TheDecreeUI] ========================================');
    }
}
