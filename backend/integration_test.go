package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/stretchr/testify/assert"
)

func setupTestRouter() *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/api/config", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, 200, map[string]string{
			"inst_name": "Test Institution",
			"dept_name": "Test Department",
		})
	})

	r.Get("/api/dashboard", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"total_mahasiswa":  150,
			"bab4_plus":        45,
			"bimbingan_rutin":  120,
			"perlu_intervensi": 15,
			"distribusi_bab": map[string]int{
				"Bab 1": 30,
				"Bab 2": 40,
			},
			"distribusi_status": map[string]int{},
			"distribusi_rutin":  map[string]int{},
			"alerts":            []interface{}{},
		})
	})

	r.Get("/api/dosen", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, 200, []map[string]string{})
	})

	r.Get("/api/mahasiswa", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, 200, []map[string]string{})
	})

	r.Get("/api/bimbingan", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, 200, []map[string]string{})
	})

	return r
}

// TestIntegrationConfigEndpoint tests the config endpoint
func TestIntegrationConfigEndpoint(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test. Set INTEGRATION_TEST=true to run")
	}

	r := setupTestRouter()

	req := httptest.NewRequest("GET", "/api/config", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
}

// TestIntegrationDashboardEndpoint tests the dashboard endpoint
func TestIntegrationDashboardEndpoint(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test. Set INTEGRATION_TEST=true to run")
	}

	r := setupTestRouter()

	req := httptest.NewRequest("GET", "/api/dashboard", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
}

// TestIntegrationListDosen tests the list dosen endpoint
func TestIntegrationListDosen(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test. Set INTEGRATION_TEST=true to run")
	}

	r := setupTestRouter()

	req := httptest.NewRequest("GET", "/api/dosen", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
}

// TestIntegrationListMahasiswa tests the list mahasiswa endpoint
func TestIntegrationListMahasiswa(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test. Set INTEGRATION_TEST=true to run")
	}

	r := setupTestRouter()

	req := httptest.NewRequest("GET", "/api/mahasiswa", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
}

// TestIntegrationListBimbingan tests the list bimbingan endpoint
func TestIntegrationListBimbingan(t *testing.T) {
	if os.Getenv("INTEGRATION_TEST") != "true" {
		t.Skip("Skipping integration test. Set INTEGRATION_TEST=true to run")
	}

	r := setupTestRouter()

	req := httptest.NewRequest("GET", "/api/bimbingan", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
}
