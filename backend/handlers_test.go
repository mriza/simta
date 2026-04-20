package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test utility functions
func TestRespondJSON(t *testing.T) {
	tests := []struct {
		name       string
		status     int
		data       interface{}
		wantStatus int
	}{
		{
			name:       "successful response",
			status:     http.StatusOK,
			data:       map[string]string{"message": "success"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "error response",
			status:     http.StatusBadRequest,
			data:       map[string]string{"error": "bad request"},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			respondJSON(w, tt.status, tt.data)

			assert.Equal(t, tt.wantStatus, w.Code)
			assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

			var response map[string]string
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)
			assert.Equal(t, tt.data, response)
		})
	}
}

func TestRespondError(t *testing.T) {
	w := httptest.NewRecorder()
	respondError(w, http.StatusInternalServerError, "test error")

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "test error", response["error"])
}

func TestDecodeJSON(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		target      interface{}
		expectError bool
		expected    interface{}
	}{
		{
			name:        "valid json",
			body:        `{"name": "test", "value": 123}`,
			target:      &map[string]interface{}{},
			expectError: false,
			expected:    &map[string]interface{}{"name": "test", "value": float64(123)},
		},
		{
			name:        "invalid json",
			body:        `{"name": "test", "value":}`,
			target:      &map[string]interface{}{},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/", bytes.NewReader([]byte(tt.body)))
			err := decodeJSON(req, tt.target)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, tt.target)
			}
		})
	}
}

func TestParseTokenFromHeader(t *testing.T) {
	// Create a valid token for testing
	validToken, _ := makeToken("user123", "dosen")

	tests := []struct {
		name         string
		authHeader   string
		expectError  bool
		expectedUID  string
		expectedRole string
	}{
		{
			name:         "valid bearer token",
			authHeader:   "Bearer " + validToken,
			expectError:  false,
			expectedUID:  "user123",
			expectedRole: "dosen",
		},
		{
			name:        "missing bearer prefix",
			authHeader:  validToken,
			expectError: true,
		},
		{
			name:        "invalid token",
			authHeader:  "Bearer invalid.token.here",
			expectError: true,
		},
		{
			name:        "empty header",
			authHeader:  "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims, err := parseTokenFromHeader(tt.authHeader)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedUID, claims.UserID)
				assert.Equal(t, tt.expectedRole, claims.Role)
			}
		})
	}
}

func TestMakeToken(t *testing.T) {
	userID := "testuser123"
	role := "dosen"

	token, err := makeToken(userID, role)
	assert.NoError(t, err)
	assert.NotEmpty(t, token)

	// Verify the token can be parsed back
	claims, err := parseTokenFromHeader("Bearer " + token)
	assert.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, role, claims.Role)
}

func TestGetContext(t *testing.T) {
	tests := []struct {
		name         string
		setupCtx     func(*http.Request) *http.Request
		expectedRole string
		expectedUID  string
	}{
		{
			name: "with auth context",
			setupCtx: func(r *http.Request) *http.Request {
				ctx := context.WithValue(r.Context(), authContextKey{}, authContext{Role: "dosen", UserID: "user123"})
				return r.WithContext(ctx)
			},
			expectedRole: "dosen",
			expectedUID:  "user123",
		},
		{
			name: "without auth context",
			setupCtx: func(r *http.Request) *http.Request {
				return r
			},
			expectedRole: "umum",
			expectedUID:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req = tt.setupCtx(req)

			role, userID := getContext(req)
			assert.Equal(t, tt.expectedRole, role)
			assert.Equal(t, tt.expectedUID, userID)
		})
	}
}

func TestRequireRole(t *testing.T) {
	tests := []struct {
		name         string
		setupCtx     func(*http.Request) *http.Request
		allowedRoles []string
		expectedRole string
		expectedUID  string
		shouldPass   bool
	}{
		{
			name: "allowed role",
			setupCtx: func(r *http.Request) *http.Request {
				ctx := context.WithValue(r.Context(), authContextKey{}, authContext{Role: "dosen", UserID: "user123"})
				return r.WithContext(ctx)
			},
			allowedRoles: []string{"dosen", "prodi"},
			expectedRole: "dosen",
			expectedUID:  "user123",
			shouldPass:   true,
		},
		{
			name: "denied role",
			setupCtx: func(r *http.Request) *http.Request {
				ctx := context.WithValue(r.Context(), authContextKey{}, authContext{Role: "mhs", UserID: "user123"})
				return r.WithContext(ctx)
			},
			allowedRoles: []string{"dosen", "prodi"},
			shouldPass:   false,
		},
		{
			name: "no auth context",
			setupCtx: func(r *http.Request) *http.Request {
				return r
			},
			allowedRoles: []string{"dosen"},
			shouldPass:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.setupCtx(httptest.NewRequest("GET", "/", nil))
			w := httptest.NewRecorder()

			role, userID, ok := requireRole(w, req, tt.allowedRoles...)

			if tt.shouldPass {
				assert.True(t, ok)
				assert.Equal(t, tt.expectedRole, role)
				assert.Equal(t, tt.expectedUID, userID)
				assert.Equal(t, http.StatusOK, w.Code)
			} else {
				assert.False(t, ok)
				assert.Equal(t, http.StatusForbidden, w.Code)
			}
		})
	}
}

func TestValidStatusProses(t *testing.T) {
	tests := []struct {
		status   string
		expected bool
	}{
		{"Bimbingan", true},
		{"Lulus", true},
		{"Lanjut", true},
		{"Berhenti", true},
		{"Invalid Status", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			result := validStatusProses(tt.status)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestValidTerm(t *testing.T) {
	tests := []struct {
		term     string
		expected bool
	}{
		{"Ganjil", true},
		{"Genap", true},
		{"Invalid Term", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.term, func(t *testing.T) {
			result := validTerm(tt.term)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestValidArtifactKind(t *testing.T) {
	tests := []struct {
		kind     string
		expected bool
	}{
		{"proposal", true},
		{"bab1", true},
		{"bab2", true},
		{"bab3", true},
		{"bab4", true},
		{"bab5", true},
		{"laporan", true},
		{"invalid", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.kind, func(t *testing.T) {
			result := validArtifactKind(tt.kind)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNormalizeArtifactExt(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"document.pdf", ".pdf"},
		{"file.DOCX", ".docx"},
		{"image.PNG", ".png"},
		{"noextension", ""},
		{"multiple.dots.file.txt", ".txt"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := normalizeArtifactExt(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestValidYouTubeURL(t *testing.T) {
	tests := []struct {
		url      string
		expected bool
	}{
		{"https://www.youtube.com/watch?v=dQw4w9WgXcQ", true},
		{"https://youtu.be/dQw4w9WgXcQ", true},
		{"https://youtube.com/watch?v=dQw4w9WgXcQ", true},
		{"https://invalid.com/watch?v=test", false},
		{"not a url", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			result := validYouTubeURL(tt.url)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestArtifactDisplayName(t *testing.T) {
	tests := []struct {
		rawURL   string
		fallback string
		expected string
	}{
		{
			rawURL:   "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			fallback: "Default",
			expected: "YouTube Video",
		},
		{
			rawURL:   "https://example.com/file.pdf",
			fallback: "Document",
			expected: "Document",
		},
		{
			rawURL:   "",
			fallback: "Fallback",
			expected: "Fallback",
		},
	}

	for _, tt := range tests {
		t.Run(tt.rawURL, func(t *testing.T) {
			result := artifactDisplayName(tt.rawURL, tt.fallback)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNullStr(t *testing.T) {
	tests := []struct {
		input    string
		expected interface{}
	}{
		{"", nil},
		{"test", "test"},
		{"   ", "   "},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := nullStr(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEmptyDefault(t *testing.T) {
	tests := []struct {
		value    string
		fallback string
		expected string
	}{
		{"", "default", "default"},
		{"value", "default", "value"},
		{"   ", "default", "   "},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%q->%q", tt.value, tt.fallback), func(t *testing.T) {
			result := emptyDefault(tt.value, tt.fallback)
			assert.Equal(t, tt.expected, result)
		})
	}
}
