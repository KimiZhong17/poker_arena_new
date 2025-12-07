import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Poker')
export class Poker extends Component {
    private _value : number = 0;
    private _back : SpriteFrame = null!;
    private _front : SpriteFrame = null!;
    private _sprite: Sprite = null!;

    public init(value: number, back: SpriteFrame, front: SpriteFrame): void {
        this._value = value;
        this._back = back;
        this._front = front;
        this._sprite = this.node.getComponent(Sprite);
    }

    public showFront(): void {
        this._sprite.spriteFrame = this._front;
    }

    public showBack(): void {
        this._sprite.spriteFrame = this._back;
    }

    public getValue(): number {
        return this._value;
    }
}


