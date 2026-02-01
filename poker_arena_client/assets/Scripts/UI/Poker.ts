import { _decorator, Component, Node, Sprite, SpriteFrame, EventTouch, Vec3, UIOpacity, Material, tween } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Callback for card click event
 * @param card The Poker component that was clicked
 * @param cardValue The card's value
 * @param cardIndex The card's index in the hand
 */
export type CardClickCallback = (card: Poker, cardValue: number, cardIndex: number) => void;

@ccclass('Poker')
export class Poker extends Component {
    private _value: number = 0;
    private _back: SpriteFrame = null!;
    private _front: SpriteFrame = null!;
    private _sprite: Sprite = null!;

    // Click handling
    private _clickCallback: CardClickCallback | null = null;
    private _cardIndex: number = -1;
    private _isSelected: boolean = false;
    private _isInteractive: boolean = false;
    private _originalY: number = 0;

    // Glow effect
    private _defaultMaterial: Material | null = null;
    private _glowMaterial: Material | null = null;
    private _isGlowEnabled: boolean = false;

    // Visual feedback settings
    private readonly SELECTED_OFFSET_Y = 20; // How much to lift the card when selected

    public init(value: number, back: SpriteFrame, front: SpriteFrame): void {
        this._value = value;
        this._back = back;
        this._front = front;
        this._sprite = this.node.getComponent(Sprite);

        // Disable dynamic atlas packing to prevent UV issues with custom materials
        if (back) back.packable = false;
        if (front) front.packable = false;

        // Store default material for later restoration
        if (this._sprite) {
            this._defaultMaterial = this._sprite.customMaterial;
        }
    }

    public showFront(): void {
        this._sprite.spriteFrame = this._front;
    }

    public showBack(): void {
        this._sprite.spriteFrame = this._back;
    }

    /**
     * Flip the card with animation (from back to front)
     * @param duration Total flip duration in seconds (default 0.3)
     * @param onComplete Callback when flip is complete
     */
    public flip(duration: number = 0.3, onComplete?: () => void): void {
        if (!this._sprite) {
            onComplete?.();
            return;
        }

        const originalScale = this.node.scale.clone();
        const halfDuration = duration / 2;

        // Flip animation: scale X to 0, switch sprite, scale X back
        tween(this.node)
            .to(halfDuration, { scale: new Vec3(0, originalScale.y, originalScale.z) }, { easing: 'sineIn' })
            .call(() => {
                this.showFront();
            })
            .to(halfDuration, { scale: originalScale }, { easing: 'sineOut' })
            .call(() => {
                onComplete?.();
            })
            .start();
    }

    public getValue(): number {
        return this._value;
    }

    /**
     * Enable click interaction on this card
     * @param cardIndex The index of this card in the hand
     * @param callback Callback function when card is clicked
     */
    public enableClick(cardIndex: number, callback: CardClickCallback): void {
        this._cardIndex = cardIndex;
        this._clickCallback = callback;
        this._isInteractive = true;

        // Store original position
        this._originalY = this.node.position.y;

        // Register touch event
        this.node.on(Node.EventType.TOUCH_END, this.onCardTouched, this);
    }

    /**
     * Disable click interaction
     */
    public disableClick(): void {
        this._isInteractive = false;
        if (this.node) {
            this.node.off(Node.EventType.TOUCH_END, this.onCardTouched, this);
        }

        // Reset to original position
        if (this._isSelected) {
            this.setSelected(false);
        }
    }

    /**
     * Handle card touch event
     */
    private onCardTouched(event: EventTouch): void {
        if (!this._isInteractive || !this._clickCallback) {
            return;
        }

        // Toggle selection
        this.setSelected(!this._isSelected);

        // Call the callback
        this._clickCallback(this, this._value, this._cardIndex);
    }

    /**
     * Set card selection state
     * @param selected Whether the card is selected
     */
    public setSelected(selected: boolean): void {
        this._isSelected = selected;

        // Visual feedback: lift the card up when selected
        const pos = this.node.position;
        if (selected) {
            this.node.setPosition(pos.x, this._originalY + this.SELECTED_OFFSET_Y, pos.z);
        } else {
            this.node.setPosition(pos.x, this._originalY, pos.z);
        }
    }

    /**
     * Check if card is selected
     */
    public isSelected(): boolean {
        return this._isSelected;
    }

    /**
     * Get card index in hand
     */
    public getCardIndex(): number {
        return this._cardIndex;
    }

    /**
     * Check if card is interactive
     */
    public isInteractive(): boolean {
        return this._isInteractive;
    }

    /**
     * Set card opacity (for dimming unselected cards)
     * @param opacity Opacity value (0-255)
     */
    public setOpacity(opacity: number): void {
        let uiOpacity = this.node.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = this.node.addComponent(UIOpacity);
        }
        uiOpacity.opacity = opacity;
    }

    /**
     * Get current opacity
     */
    public getOpacity(): number {
        const uiOpacity = this.node.getComponent(UIOpacity);
        return uiOpacity ? uiOpacity.opacity : 255;
    }

    /**
     * Set glow material for rim light effect
     * @param material The glow material to use
     */
    public setGlowMaterial(material: Material): void {
        this._glowMaterial = material;
    }

    /**
     * Enable or disable glow effect
     * @param enabled Whether to enable glow
     */
    public setGlowEnabled(enabled: boolean): void {
        if (!this._sprite) return;

        this._isGlowEnabled = enabled;

        if (enabled && this._glowMaterial) {
            this._sprite.customMaterial = this._glowMaterial;
            // Bind the sprite's texture to the material
            const spriteFrame = this._sprite.spriteFrame;
            if (spriteFrame && spriteFrame.texture) {
                const matInst = this._sprite.getMaterialInstance(0);
                if (matInst) {
                    matInst.setProperty('mainTexture', spriteFrame.texture);
                }
            }
        } else {
            this._sprite.customMaterial = this._defaultMaterial;
        }
    }

    /**
     * Check if glow is enabled
     */
    public isGlowEnabled(): boolean {
        return this._isGlowEnabled;
    }
}


