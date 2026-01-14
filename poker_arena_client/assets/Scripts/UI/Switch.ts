import { _decorator, Component, Node, Sprite, Vec3, tween, UITransform, EventHandler, Color } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Switch Component
 * A toggle switch UI component with smooth animation
 *
 * Usage:
 * 1. Create a Node and attach this component
 * 2. Assign Track_Bg, Track_On, and Handle sprites in the editor
 * 3. Register callback via onValueChanged event or code
 *
 * Structure:
 * - Switch (this component)
 *   - Track_Bg (background track sprite)
 *   - Track_On (active track sprite, shows when ON)
 *   - Handle (draggable handle sprite)
 */
@ccclass('Switch')
export class Switch extends Component {

    @property(Sprite)
    public trackBg: Sprite | null = null;

    @property(Sprite)
    public trackOn: Sprite | null = null;

    @property(Sprite)
    public handle: Sprite | null = null;

    @property
    public isOn: boolean = false;

    @property
    public animationDuration: number = 0.2;

    @property([EventHandler])
    public onValueChanged: EventHandler[] = [];

    // Private
    private _handleOffPosition: Vec3 = new Vec3();
    private _handleOnPosition: Vec3 = new Vec3();
    private _isAnimating: boolean = false;
    private _trackWidth: number = 0;
    private _handleWidth: number = 0;

    onLoad() {
        this.initializePositions();
        this.setupClickEvent();
        this.updateVisualState(false); // Initialize without animation
    }

    start() {
        // Apply initial state
        this.updateVisualState(false);
    }

    /**
     * Initialize handle positions based on track and handle sizes
     */
    private initializePositions(): void {
        if (!this.trackBg || !this.handle) {
            console.error('[Switch] Track or Handle not assigned!');
            return;
        }

        const trackTransform = this.trackBg.node.getComponent(UITransform);
        const handleTransform = this.handle.node.getComponent(UITransform);

        if (!trackTransform || !handleTransform) {
            console.error('[Switch] UITransform not found!');
            return;
        }

        this._trackWidth = trackTransform.width;
        this._handleWidth = handleTransform.width;

        // Calculate handle positions
        // OFF position: left side of track
        const padding = 5; // Small padding from edge
        const leftX = -this._trackWidth / 2 + this._handleWidth / 2 + padding;
        const rightX = this._trackWidth / 2 - this._handleWidth / 2 - padding;

        this._handleOffPosition.set(leftX, 0, 0);
        this._handleOnPosition.set(rightX, 0, 0);

        console.log('[Switch] Initialized positions:', {
            trackWidth: this._trackWidth,
            handleWidth: this._handleWidth,
            offPosition: this._handleOffPosition.clone(),
            onPosition: this._handleOnPosition.clone()
        });
    }

    /**
     * Setup click event on the switch
     */
    private setupClickEvent(): void {
        this.node.on(Node.EventType.TOUCH_END, this.onSwitchClicked, this);
    }

    /**
     * Handle switch click
     */
    private onSwitchClicked(): void {
        if (this._isAnimating) {
            return;
        }

        this.toggle();
    }

    /**
     * Toggle the switch state
     */
    public toggle(): void {
        this.setValue(!this.isOn);
    }

    /**
     * Set switch value
     * @param value New value (true = ON, false = OFF)
     * @param silent If true, won't trigger onValueChanged callback
     */
    public setValue(value: boolean, silent: boolean = false): void {
        if (this.isOn === value) {
            return;
        }

        const oldValue = this.isOn;
        this.isOn = value;

        console.log(`[Switch] Value changed: ${oldValue} -> ${this.isOn}`);

        // Update visual state with animation
        this.updateVisualState(true);

        // Trigger callback
        if (!silent) {
            this.triggerValueChangedEvent();
        }
    }

    /**
     * Update visual state (handle position and track visibility)
     * @param animated Whether to animate the transition
     */
    private updateVisualState(animated: boolean): void {
        if (!this.handle || !this.trackOn) {
            return;
        }

        const targetPosition = this.isOn ? this._handleOnPosition : this._handleOffPosition;
        const targetOpacity = this.isOn ? 255 : 0;

        if (animated) {
            this._isAnimating = true;

            // Animate handle position
            tween(this.handle.node)
                .to(this.animationDuration, { position: targetPosition }, {
                    easing: 'sineOut'
                })
                .call(() => {
                    this._isAnimating = false;
                })
                .start();

            // Animate track_on opacity
            const trackOnSprite = this.trackOn;
            const startColor = trackOnSprite.color.clone();
            const endColor = new Color(startColor.r, startColor.g, startColor.b, targetOpacity);

            tween(trackOnSprite)
                .to(this.animationDuration, { color: endColor }, {
                    easing: 'sineOut'
                })
                .start();

        } else {
            // Set immediately without animation
            this.handle.node.setPosition(targetPosition);

            const trackOnColor = this.trackOn.color.clone();
            trackOnColor.a = targetOpacity;
            this.trackOn.color = trackOnColor;
        }
    }

    /**
     * Trigger value changed event
     */
    private triggerValueChangedEvent(): void {
        console.log('[Switch] Triggering onValueChanged event, isOn:', this.isOn);

        // Trigger EventHandler callbacks
        // 第一个参数是事件数组，第二个参数会作为 event 传递给回调函数
        EventHandler.emitEvents(this.onValueChanged, this);
    }

    /**
     * Register a callback for value changes (code-based registration)
     * @param callback Function to call when value changes
     * @param target Target object for the callback
     */
    public registerCallback(callback: (isOn: boolean) => void, target?: any): void {
        const handler = new EventHandler();
        handler.target = target || this.node;
        handler.component = target?.constructor.name || 'Switch';
        handler.handler = callback.name;
        handler.customEventData = '';

        this.onValueChanged.push(handler);

        console.log('[Switch] Callback registered');
    }

    /**
     * Get current switch value
     */
    public getValue(): boolean {
        return this.isOn;
    }

    /**
     * Clean up
     */
    onDestroy() {
        if (this.node) {
            this.node.off(Node.EventType.TOUCH_END, this.onSwitchClicked, this);
        }
    }
}
