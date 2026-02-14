package game

// Card suits (high 4 bits)
const (
	SuitDiamond = 0x00
	SuitClub    = 0x10
	SuitHeart   = 0x20
	SuitSpade   = 0x30
	SuitJoker   = 0x40
)

// Card points (low 4 bits)
const (
	Point3  = 3
	Point4  = 4
	Point5  = 5
	Point6  = 6
	Point7  = 7
	Point8  = 8
	Point9  = 9
	Point10 = 10
	PointJ  = 11
	PointQ  = 12
	PointK  = 13
	PointA  = 14
	Point2  = 15 // Guandan encoding

	BlackJoker = 0x01
	RedJoker   = 0x02
)

func GetSuit(card int) int {
	return card & 0xF0
}

func GetPoint(card int) int {
	return card & 0x0F
}

// TexasRank maps card point to Texas Hold'em ranking (A=14 highest, 2=2 lowest)
func TexasRank(point int) int {
	switch point {
	case PointA:
		return 14
	case Point2:
		return 2
	default:
		return point
	}
}

// SuitValue returns suit comparison value (Spade > Heart > Club > Diamond)
func SuitValue(suit int) int {
	switch suit {
	case SuitSpade:
		return 4
	case SuitHeart:
		return 3
	case SuitClub:
		return 2
	case SuitDiamond:
		return 1
	default:
		return 0
	}
}
