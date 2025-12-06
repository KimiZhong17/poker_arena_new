import { _decorator, Component, instantiate, Node, Prefab, Sprite, SpriteAtlas, SpriteFrame } from 'cc';
import { Poker } from './Poker';
const { ccclass, property } = _decorator;

@ccclass('PokerFactory')
export class PokerFactory extends Component {
    public static instance: PokerFactory = null!;

    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;

    public init(pokerSprites: Map<string, SpriteFrame>, pokerPrefab: Prefab): void {
        PokerFactory.instance = this;
        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;

    }

    /**
     * Create a poker card
     * @param pokerValue Poker card value (2-14, where 11=J, 12=Q, 13=K, 14=A)
     * @param suit Suit ("Club", "Diamond", "Heart", "Spade"), default is Spade
     */
    public createPoker(pokerValue: number, suit: string = "Spade"): void {
        // Create poker node
        var poker = instantiate(this._pokerPrefab);

        // Add to scene
        this.node.getChildByName("PokerRoot")?.addChild(poker);

        var pokerCtrl = poker.addComponent(Poker);
        var pokerBack = this._pokerSprites.get("PokerBack");
        var pokerFront = this._pokerSprites.get("Spade_A");

        console.log(`创建扑克牌: ${suit}_${pokerValue}`);

        if (!pokerFront) {
            console.error(`找不到扑克牌图片: ${suit}_${pokerValue}`);
            return;
        }

        pokerCtrl.init(pokerValue, pokerBack, pokerFront);
        pokerCtrl.showFront();
    }

}


