package game

import (
	"math/rand"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func randIntn(n int) int {
	return rand.Intn(n)
}
