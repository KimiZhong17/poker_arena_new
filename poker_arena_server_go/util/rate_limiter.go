package util

import (
	"sync"
	"time"
)

type RateLimitConfig struct {
	WindowMs    int64
	MaxRequests int
}

type rateLimitEntry struct {
	count     int
	resetTime int64
}

type RateLimiter struct {
	mu     sync.Mutex
	limits map[string]*rateLimitEntry
	config RateLimitConfig
}

func NewRateLimiter(config RateLimitConfig) *RateLimiter {
	return &RateLimiter{
		limits: make(map[string]*rateLimitEntry),
		config: config,
	}
}

func (r *RateLimiter) IsAllowed(key string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now().UnixMilli()
	entry, exists := r.limits[key]

	if !exists || now >= entry.resetTime {
		r.limits[key] = &rateLimitEntry{
			count:     1,
			resetTime: now + r.config.WindowMs,
		}
		return true
	}

	if entry.count >= r.config.MaxRequests {
		return false
	}

	entry.count++
	return true
}

func (r *RateLimiter) Cleanup() {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now().UnixMilli()
	for key, entry := range r.limits {
		if now >= entry.resetTime {
			delete(r.limits, key)
		}
	}
}

// Presets
var (
	GameActionLimit  = RateLimitConfig{WindowMs: 1000, MaxRequests: 10}
	RoomActionLimit  = RateLimitConfig{WindowMs: 1000, MaxRequests: 5}
	ConnectionLimit  = RateLimitConfig{WindowMs: 60000, MaxRequests: 10}
)
