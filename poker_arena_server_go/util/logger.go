package util

import (
	"fmt"
	"log"
	"os"
	"strings"
)

type LogLevel int

const (
	LevelDebug LogLevel = iota
	LevelInfo
	LevelWarn
	LevelError
	LevelNone
)

var logger = &Logger{level: LevelInfo}

type Logger struct {
	level LogLevel
}

func SetLogLevel(level string) {
	switch strings.ToUpper(level) {
	case "DEBUG":
		logger.level = LevelDebug
	case "INFO":
		logger.level = LevelInfo
	case "WARN":
		logger.level = LevelWarn
	case "ERROR":
		logger.level = LevelError
	case "NONE":
		logger.level = LevelNone
	default:
		logger.level = LevelInfo
	}
}

func Debug(tag, msg string, args ...interface{}) {
	if logger.level <= LevelDebug {
		log.Printf("[%s] %s", tag, fmt.Sprintf(msg, args...))
	}
}

func Info(tag, msg string, args ...interface{}) {
	if logger.level <= LevelInfo {
		log.Printf("[%s] %s", tag, fmt.Sprintf(msg, args...))
	}
}

func Warn(tag, msg string, args ...interface{}) {
	if logger.level <= LevelWarn {
		log.Printf("[%s] WARN: %s", tag, fmt.Sprintf(msg, args...))
	}
}

func Error(tag, msg string, args ...interface{}) {
	if logger.level <= LevelError {
		log.Printf("[%s] ERROR: %s", tag, fmt.Sprintf(msg, args...))
	}
}

func Fatal(tag, msg string, args ...interface{}) {
	log.Printf("[%s] FATAL: %s", tag, fmt.Sprintf(msg, args...))
	os.Exit(1)
}
