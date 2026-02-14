package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"poker-arena-server/config"
	"poker-arena-server/core"
	"poker-arena-server/util"
)

func main() {
	cfg := config.Default()
	util.SetLogLevel(cfg.LogLevel)

	srv := core.NewGameServer(cfg)

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":    "ok",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	// Stats
	mux.HandleFunc("/stats", srv.StatsHandler)

	// WebSocket endpoint
	mux.HandleFunc("/ws", srv.HandleWebSocket)

	httpSrv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: corsMiddleware(mux),
	}

	// Get local IP
	localIP := getLocalIP()

	// Start server in goroutine
	go func() {
		util.Info("Server", "==================================================")
		util.Info("Server", "Poker Arena Server (Go)")
		util.Info("Server", "==================================================")
		util.Info("Server", "Local:     http://localhost:%d", cfg.Port)
		util.Info("Server", "Network:   http://%s:%d", localIP, cfg.Port)
		util.Info("Server", "WebSocket: ws://%s:%d/ws", localIP, cfg.Port)
		util.Info("Server", "==================================================")
		util.Info("Server", "Server is ready to accept connections!")

		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			util.Fatal("Server", "ListenAndServe: %v", err)
		}
	}()

	// Wait for interrupt signal
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	util.Info("Server", "Shutting down gracefully...")
	srv.Shutdown()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	httpSrv.Shutdown(shutdownCtx)

	util.Info("Server", "Server stopped")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "localhost"
	}
	for _, addr := range addrs {
		if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
			if ipNet.IP.To4() != nil {
				return ipNet.IP.String()
			}
		}
	}
	return "localhost"
}
