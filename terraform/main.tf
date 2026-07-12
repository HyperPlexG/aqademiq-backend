# Aqademiq GCP infrastructure (§6). Region-pinned EU/UAE (§4.9).
terraform {
  required_providers { google = { source = "hashicorp/google", version = "~> 5.0" } }
}
variable "project_id" { type = string }
variable "region"     { type = string  default = "europe-west1" }
provider "google" { project = var.project_id  region = var.region }

# --- Cloud SQL: Postgres primary datastore (§7) ---
resource "google_sql_database_instance" "pg" {
  name             = "aqademiq-db"
  database_version = "POSTGRES_16"
  region           = var.region
  settings {
    tier              = "db-custom-2-8192"
    availability_type = "REGIONAL"          # HA
    backup_configuration { enabled = true   point_in_time_recovery_enabled = true }
    ip_configuration { ipv4_enabled = false  private_network = google_compute_network.vpc.id }
  }
  deletion_protection = true
}
resource "google_sql_database" "app" { name = "aqademiq"  instance = google_sql_database_instance.pg.name }

# --- Memorystore Redis: cache/queue/rate-limit/pubsub (§7) ---
resource "google_redis_instance" "cache" {
  name                    = "aqademiq-cache"
  tier                    = "STANDARD_HA"
  memory_size_gb          = 4
  region                  = var.region
  redis_version           = "REDIS_7_0"
  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  authorized_network      = google_compute_network.vpc.id
}

# --- Cloud Storage: private user bucket + public Prism CDN bucket (§4.4) ---
resource "google_storage_bucket" "user_assets" {
  name                        = "${var.project_id}-aqademiq-user"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"     # private (§4.4)
  versioning { enabled = true }
}
resource "google_storage_bucket" "prism_cdn" {
  name                        = "${var.project_id}-aqademiq-prism"
  location                    = var.region
  uniform_bucket_level_access = true            # public CDN bucket (§2.11)
}

# --- Network + Serverless VPC connector (Cloud Run → private SQL/Redis) ---
resource "google_compute_network" "vpc" { name = "aqademiq-vpc"  auto_create_subnetworks = true }
resource "google_vpc_access_connector" "connector" {
  name          = "aqademiq-connector"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"
}

# --- Cloud Run: the API service (§6) ---
resource "google_cloud_run_v2_service" "api" {
  name     = "aqademiq-api"
  location = var.region
  template {
    vpc_access { connector = google_vpc_access_connector.connector.id  egress = "PRIVATE_RANGES_ONLY" }
    scaling { min_instance_count = 1  max_instance_count = 20 }
    containers {
      image = "gcr.io/${var.project_id}/aqademiq-api:latest"
      ports { container_port = 8080 }
      # DATABASE_URL, REDIS_*, JWT keys, Claude, etc. injected from Secret Manager.
    }
  }
}

# TODO(§4.5): second Cloud Run service (or job) running BullMQ workers.
# TODO(§7): Secret Manager secrets, Identity Platform, FCM/APNs, email provider.
output "redis_host" { value = google_redis_instance.cache.host }
output "api_url"    { value = google_cloud_run_v2_service.api.uri }
