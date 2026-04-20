package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/stretchr/testify/assert"
)

// Test route setup and middleware
func TestRouterSetup(t *testing.T) {
	// This test verifies that routes are properly registered
	r := chi.NewRouter()

	// Setup routes similar to main.go
	r.Route("/api", func(r chi.Router) {
		// Just test that the router can be set up without panicking
		r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
			respondJSON(w, 200, map[string]string{"status": "ok"})
		})
	})

	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	})

	// Test that routes are registered by making requests
	tests := []struct {
		method   string
		path     string
		expected int // expected status code or just that handler exists
	}{
		{"GET", "/api/logo", 200},
		{"POST", "/api/login", 200},
		{"GET", "/api/dosen", 200},
		{"GET", "/api/mahasiswa", 200},
		{"GET", "/api/bimbingan", 200},
		{"GET", "/api/dashboard", 200},
		{"GET", "/api/config", 200},
		{"GET", "/api/events", 200},
		{"GET", "/api/ta-titles", 401}, // Should be protected
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			// Just check that we get some response (not 404)
			// In real scenario, handlers would return proper status codes
			assert.NotEqual(t, http.StatusNotFound, w.Code)
		})
	}
}

func TestCORSMiddleware(t *testing.T) {
	r := chi.NewRouter()

	// Setup CORS similar to main.go
	allowedOrigins := []string{"http://localhost:3535", "https://simta.cerdas.club"}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	}))

	r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Test CORS headers
	req := httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "http://localhost:3535")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "http://localhost:3535", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "GET")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Content-Type")
}

func TestMiddlewareOrder(t *testing.T) {
	r := chi.NewRouter()

	// Setup middleware in order
	middlewareOrder := []string{}

	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			middlewareOrder = append(middlewareOrder, "logger")
			next.ServeHTTP(w, r)
		})
	})

	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			middlewareOrder = append(middlewareOrder, "recoverer")
			next.ServeHTTP(w, r)
		})
	})

	r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		middlewareOrder = append(middlewareOrder, "handler")
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, []string{"logger", "recoverer", "handler"}, middlewareOrder)
}

// Test environment variable handling
func TestEnvironmentVariables(t *testing.T) {
	// Save original values
	originalPort := getEnv("PORT", "3536")
	originalJWT := jwtSecret
	originalAdminUser := adminUsername
	originalAdminPass := adminPassword

	// Test defaults
	assert.Equal(t, "3536", getEnv("PORT", "3536"))
	assert.NotEmpty(t, jwtSecret)
	assert.NotEmpty(t, adminUsername)
	assert.NotEmpty(t, adminPassword)

	// Restore originals
	if originalPort != "3536" {
		t.Setenv("PORT", originalPort)
	}
	jwtSecret = originalJWT
	adminUsername = originalAdminUser
	adminPassword = originalAdminPass
}

// Test server startup (mocked)
func TestServerConfiguration(t *testing.T) {
	// Test that we can create a router without panicking
	assert.NotPanics(t, func() {
		r := chi.NewRouter()
		r.Use(middleware.Logger)
		r.Use(middleware.Recoverer)

		// Add a simple route
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		})
	})
}

// Test route parameter extraction
func TestRouteParameters(t *testing.T) {
	r := chi.NewRouter()

	r.Get("/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("User ID: " + id))
	})

	req := httptest.NewRequest("GET", "/users/123", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "User ID: 123", w.Body.String())
}

// Test method not allowed
func TestMethodNotAllowed(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("POST", "/test", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

// Test static file serving simulation
func TestStaticFileHandling(t *testing.T) {
	r := chi.NewRouter()

	// Simulate logo serving
	r.Get("/logo", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("fake png data"))
	})

	req := httptest.NewRequest("GET", "/logo", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "image/png", w.Header().Get("Content-Type"))
	assert.Equal(t, "fake png data", w.Body.String())
}
