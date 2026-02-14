package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port                    int
	CORSOrigin              string
	MaxRooms                int
	RoomIdleTimeout         time.Duration
	HeartbeatInterval       time.Duration
	PlayerDisconnectTimeout time.Duration
	AutoPlayTimeout         time.Duration
	AutoPlayActionDelay     time.Duration
	LogLevel                string
}

func Default() *Config {
	return &Config{
		Port:                    envInt("PORT", 3000),
		CORSOrigin:             envStr("CORS_ORIGIN", "http://localhost:8080"),
		MaxRooms:                100,
		RoomIdleTimeout:         30 * time.Minute,
		HeartbeatInterval:       30 * time.Second,
		PlayerDisconnectTimeout: 90 * time.Second,
		AutoPlayTimeout:         30 * time.Second,
		AutoPlayActionDelay:     2 * time.Second,
		LogLevel:                envStr("LOG_LEVEL", "info"),
	}
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
