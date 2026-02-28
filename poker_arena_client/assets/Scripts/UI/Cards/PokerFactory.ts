import { _decorator, Component, instantiate, Node, Prefab, Sprite, SpriteAtlas, SpriteFrame } from 'cc';
import { Poker } from './Poker';
import { CardUtils } from '../../Card/CardUtils';
import { CardSuit, CardPoint } from '../../Card/CardConst';
const { ccclass, property } = _decorator;

@ccclass('PokerFactory')
export class PokerFactory extends Component {
    public static instance: PokerFactory = null!;

    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;

    public get pokerSprites(): Map<string, SpriteFrame> {
        return this._pokerSprites;
    }

    public get pokerPrefab(): Prefab {
        return this._pokerPrefab;
    }

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
        var pokerBack = this._pokerSprites.get("CardBack3");
        var pokerFront = this._pokerSprites.get(`${suit}_${pokerValue}`);

        if (!pokerFront) return;

        pokerCtrl.init(pokerValue, pokerBack, pokerFront);
        pokerCtrl.showBack();
    }

    public static getCardSpriteName(card: number): string {
        const suit = CardUtils.getSuit(card);
        const point = CardUtils.getPoint(card);

        // Jokers
        if (suit === CardSuit.JOKER) {
            return point === CardPoint.RED_JOKER ? "Joker_Red" : "Joker_Black";
        }

        // Normal cards
        let suitStr = "";
        switch (suit) {
            case CardSuit.SPADE: suitStr = "Spade"; break;
            case CardSuit.HEART: suitStr = "Heart"; break;
            case CardSuit.DIAMOND: suitStr = "Diamond"; break;
            case CardSuit.CLUB: suitStr = "Club"; break;
        }
        let pointStr = point.toString();
        if (point === 15) pointStr = "2";

        return `${suitStr}_${pointStr}`;    
    }
}


