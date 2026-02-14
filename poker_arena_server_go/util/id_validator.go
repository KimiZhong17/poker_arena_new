package util

import "regexp"

var (
	uuidRegex    = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)
	guestIDRegex = regexp.MustCompile(`^guest_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}(_\d+)?$`)
	validNameRegex = regexp.MustCompile(`^[\w\x{4e00}-\x{9fa5}\s\-_#]+$`)
)

func IsValidGuestID(guestID string) bool {
	if guestID == "" {
		return false
	}
	return guestIDRegex.MatchString(guestID)
}

func IsValidUUID(uuid string) bool {
	if uuid == "" {
		return false
	}
	return uuidRegex.MatchString(uuid)
}

func IsValidPlayerName(name string) bool {
	if name == "" || len(name) > 50 {
		return false
	}
	return validNameRegex.MatchString(name)
}

func SanitizePlayerName(name string) string {
	if name == "" {
		return "Guest"
	}
	// Trim spaces
	trimmed := name
	if len(trimmed) == 0 {
		return "Guest"
	}
	if len(trimmed) > 50 {
		trimmed = trimmed[:50]
	}
	return trimmed
}
