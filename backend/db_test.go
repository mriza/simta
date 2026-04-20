package main

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
)

// Test environment utilities
func TestGetEnv(t *testing.T) {
	// Test with existing env var
	os.Setenv("TEST_VAR", "test_value")
	defer os.Unsetenv("TEST_VAR")

	result := getEnv("TEST_VAR", "default")
	assert.Equal(t, "test_value", result)

	// Test with non-existing env var
	result = getEnv("NON_EXISTING_VAR", "default_value")
	assert.Equal(t, "default_value", result)
}

func TestLoadDotEnv(t *testing.T) {
	// Create a temporary .env file
	tempDir := t.TempDir()
	envFile := filepath.Join(tempDir, ".env")

	envContent := `TEST_KEY1=value1
TEST_KEY2=value2
# This is a comment
EMPTY_VAR=
`

	err := os.WriteFile(envFile, []byte(envContent), 0644)
	assert.NoError(t, err)

	// Clear any existing env vars
	os.Unsetenv("TEST_KEY1")
	os.Unsetenv("TEST_KEY2")
	os.Unsetenv("EMPTY_VAR")

	// Load the .env file
	loadDotEnv(envFile)

	// Check if env vars were loaded
	assert.Equal(t, "value1", os.Getenv("TEST_KEY1"))
	assert.Equal(t, "value2", os.Getenv("TEST_KEY2"))
	assert.Equal(t, "", os.Getenv("EMPTY_VAR"))

	// Clean up
	os.Unsetenv("TEST_KEY1")
	os.Unsetenv("TEST_KEY2")
	os.Unsetenv("EMPTY_VAR")
}

func TestParseCommaSeparated(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"a,b,c", []string{"a", "b", "c"}},
		{"a, b , c ", []string{"a", "b", "c"}},
		{"single", []string{"single"}},
		{"", []string(nil)},
		{"a,,b", []string{"a", "b"}},
		{"  spaced  ,  values  ", []string{"spaced", "values"}},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := parseCommaSeparated(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRebind(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "PostgreSQL placeholders",
			input:    "SELECT * FROM users WHERE id = ? AND name = ?",
			expected: "SELECT * FROM users WHERE id = $1 AND name = $2",
		},
		{
			name:     "Mixed placeholders",
			input:    "SELECT * FROM users WHERE id = ? OR name = ? AND age > ?",
			expected: "SELECT * FROM users WHERE id = $1 OR name = $2 AND age > $3",
		},
		{
			name:     "No placeholders",
			input:    "SELECT * FROM users",
			expected: "SELECT * FROM users",
		},
		{
			name:     "Single placeholder",
			input:    "SELECT * FROM users WHERE id = ?",
			expected: "SELECT * FROM users WHERE id = $1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rebind(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMin(t *testing.T) {
	tests := []struct {
		a, b     int
		expected int
	}{
		{1, 2, 1},
		{2, 1, 1},
		{5, 5, 5},
		{-1, 1, -1},
		{0, 0, 0},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("min(%d,%d)", tt.a, tt.b), func(t *testing.T) {
			result := min(tt.a, tt.b)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestUid(t *testing.T) {
	prefix := "test"

	// Generate multiple UIDs to ensure uniqueness
	uids := make(map[string]bool)
	for i := 0; i < 100; i++ {
		id := uid(prefix)
		assert.True(t, strings.HasPrefix(id, prefix+"-"), "UID should start with prefix")
		assert.True(t, len(id) > len(prefix)+1, "UID should be longer than prefix")

		// Check uniqueness
		assert.False(t, uids[id], "UID should be unique")
		uids[id] = true
	}
}

// Test password hashing (without database dependency)
func TestPasswordHashing(t *testing.T) {
	password := "testpassword123"

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	assert.NoError(t, err)
	assert.NotEmpty(t, hash)

	// Verify password
	err = bcrypt.CompareHashAndPassword(hash, []byte(password))
	assert.NoError(t, err)

	// Test wrong password
	err = bcrypt.CompareHashAndPassword(hash, []byte("wrongpassword"))
	assert.Error(t, err)
}

// Test file operations (mocked)
func TestFileOperations(t *testing.T) {
	// Test filepath operations
	testPath := "/uploads/test/file.pdf"
	dir := filepath.Dir(testPath)
	base := filepath.Base(testPath)
	ext := filepath.Ext(testPath)

	assert.Equal(t, "/uploads/test", dir)
	assert.Equal(t, "file.pdf", base)
	assert.Equal(t, ".pdf", ext)
}

// Test string utilities
func TestStringUtilities(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"trim spaces", "  hello world  ", "hello world"},
		{"to upper", "hello", "HELLO"},
		{"to lower", "HELLO", "hello"},
		{"title case", "hello world", "Hello World"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var result string
			switch tt.name {
			case "trim spaces":
				result = strings.TrimSpace(tt.input)
			case "to upper":
				result = strings.ToUpper(tt.input)
			case "to lower":
				result = strings.ToLower(tt.input)
			case "title case":
				result = strings.Title(strings.ToLower(tt.input))
			}
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Test time utilities
func TestTimeUtilities(t *testing.T) {
	now := time.Now()
	past := now.Add(-24 * time.Hour)

	assert.True(t, past.Before(now))
	assert.True(t, now.After(past))

	// Test time formatting
	formatted := now.Format("2006-01-02")
	assert.Contains(t, formatted, "-")
	assert.Equal(t, 10, len(formatted)) // YYYY-MM-DD format
}

// Test random utilities
func TestRandomUtilities(t *testing.T) {
	// Test random number generation
	rand.Seed(time.Now().UnixNano())

	// Generate random numbers and ensure they're within range
	for i := 0; i < 10; i++ {
		num := rand.Intn(100)
		assert.True(t, num >= 0 && num < 100, "Random number should be between 0 and 99")
	}

	// Test random string generation (simulated)
	chars := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	randomStr := make([]byte, 10)
	for i := range randomStr {
		randomStr[i] = chars[rand.Intn(len(chars))]
	}
	assert.Equal(t, 10, len(randomStr))
}

// Test strconv utilities
func TestStrconvUtilities(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int
		hasError bool
	}{
		{"valid int", "123", 123, false},
		{"zero", "0", 0, false},
		{"negative", "-456", -456, false},
		{"invalid", "abc", 0, true},
		{"empty", "", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := strconv.Atoi(tt.input)
			if tt.hasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}
