package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

var (
	jwtSecret     string
	adminUsername string
	adminPassword string
)

func main() {
	loadDotEnv(".env")
	jwtSecret = getEnv("JWT_SECRET", "very-secret-simta-key")
	adminUsername = getEnv("ADMIN_USERNAME", "admin")
	adminPassword = getEnv("ADMIN_PASSWORD", "admin123")

	if jwtSecret == "very-secret-simta-key" {
		log.Println("WARNING: JWT_SECRET not set, using default")
	}

	if err := initDB(""); err != nil {
		log.Fatal("DB init:", err)
	}

	r := chi.NewRouter()
	allowedOrigins := parseCommaSeparated(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3535,https://simta.cerdas.club,https://api-simta.cerdas.club"))
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(populateAuthContext)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	}))

	r.Route("/api", func(r chi.Router) {
		// Public
		r.Get("/logo", getPublicLogo)
		r.Post("/login", login)
		r.Get("/public/verify-sidang/{token}", verifySidangToken)
		r.Get("/dosen", listDosen)
		r.Get("/mahasiswa", listMahasiswa)
		r.Get("/bimbingan", listBimbingan)
		r.Get("/dashboard", getDashboard)
		r.Get("/config", getConfig)
		r.Get("/events", listEvents)

		// Protected
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware)

			r.Put("/password", changePassword)

			r.Post("/dosen", createDosen)
			r.Put("/dosen/{id}", updateDosen)
			r.Delete("/dosen/{id}", deleteDosen)

			r.Post("/mahasiswa", createMahasiswa)
			r.Put("/mahasiswa/{id}", updateMahasiswa)
			r.Put("/mahasiswa/{id}/permit-sidang", permitSidang)
			r.Get("/mahasiswa/sidang-token", getSidangToken)
			r.Post("/mahasiswa/upload-final", uploadFinalReport)
			r.Get("/mahasiswa/{id}/download-final", downloadFinalReport)
			r.Delete("/mahasiswa/{id}", deleteMahasiswa)
			r.Post("/mahasiswa/batch-status", updateMahasiswaBatchStatus)

			r.Post("/bimbingan", createBimbingan)
			r.Put("/bimbingan/{id}", updateBimbingan)
			r.Post("/bimbingan/{id}/submit", submitBimbingan)
			r.Post("/bimbingan/{id}/accept", acceptBimbingan)
			r.Post("/bimbingan/{id}/complete", completeBimbingan)
			r.Post("/bimbingan/{id}/offline", scheduleOffline)
			r.Put("/bimbingan/{id}/offline-status", updateOfflineStatus)
			r.Post("/bimbingan/{id}/reopen", reopenBimbingan)
			r.Delete("/bimbingan/{id}", deleteBimbingan)

			r.Post("/reset-semester", resetSemester)

			r.Get("/export/csv", exportCSV)

			r.Put("/config", updateConfig)
			r.Post("/config/logo", uploadLogo)

			r.Post("/events", createEvent)
			r.Put("/events/{id}", updateEvent)
			r.Delete("/events/{id}", deleteEvent)

			r.Get("/semesters", listSemesters)
			r.Post("/semesters/start", startSemester)
			r.Post("/semesters/{id}/close", closeSemester)

			r.Get("/berkas", listBerkas)
			r.Post("/berkas", uploadBerkas)
			r.Get("/berkas/{id}", downloadBerkas)
			r.Get("/berkas/{id}/view", viewBerkas)
			r.Put("/berkas/{id}/feedback", updateBerkasFeedback)

			r.Get("/ta-titles", listTATitles)
		})
	})

	port := getEnv("PORT", "3536")
	log.Println("SIMTA backend running on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
