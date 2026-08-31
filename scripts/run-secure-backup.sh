#!/usr/bin/env bash
set -euo pipefail

required=(
  SUPABASE_DB_URL
  SUPABASE_STORAGE_S3_ENDPOINT
  SUPABASE_STORAGE_S3_REGION
  SUPABASE_STORAGE_S3_ACCESS_KEY_ID
  SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY
  BACKUP_S3_ENDPOINT
  BACKUP_S3_REGION
  BACKUP_S3_BUCKET
  BACKUP_S3_ACCESS_KEY_ID
  BACKUP_S3_SECRET_ACCESS_KEY
)

for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required backup secret: ${name}" >&2
    exit 2
  fi
done

command -v supabase >/dev/null 2>&1 || { echo "Supabase CLI is required." >&2; exit 3; }
command -v rclone >/dev/null 2>&1 || { echo "rclone is required." >&2; exit 3; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum is required." >&2; exit 3; }

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
root="${RUNNER_TEMP:-/tmp}/ficonter-backup-${stamp}"
db_dir="${root}/database"
manifest_dir="${root}/manifest"
mkdir -p "${db_dir}" "${manifest_dir}"
trap 'rm -rf "${root}"' EXIT

echo "Creating Supabase logical database exports..."
supabase db dump --db-url "${SUPABASE_DB_URL}" -f "${db_dir}/roles.sql" --role-only
supabase db dump --db-url "${SUPABASE_DB_URL}" -f "${db_dir}/schema.sql"
supabase db dump --db-url "${SUPABASE_DB_URL}" -f "${db_dir}/data.sql" --data-only --use-copy -x "storage.buckets_vectors" -x "storage.vector_indexes"

(
  cd "${root}"
  sha256sum database/*.sql > manifest/sha256.txt
)

cat > "${manifest_dir}/backup-info.txt" <<EOF
product=FICONTER
created_utc=${stamp}
project_ref=bbqwhesigazgziiuexlv
region=eu-central-1
database_format=supabase_cli_logical_dump
storage_format=s3_object_copy
EOF

export RCLONE_CONFIG_SUPABASE_TYPE=s3
export RCLONE_CONFIG_SUPABASE_PROVIDER=Other
export RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID="${SUPABASE_STORAGE_S3_ACCESS_KEY_ID}"
export RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY="${SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_SUPABASE_ENDPOINT="${SUPABASE_STORAGE_S3_ENDPOINT}"
export RCLONE_CONFIG_SUPABASE_REGION="${SUPABASE_STORAGE_S3_REGION}"
export RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE=true

export RCLONE_CONFIG_BACKUP_TYPE=s3
export RCLONE_CONFIG_BACKUP_PROVIDER=Other
export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID}"
export RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_BACKUP_ENDPOINT="${BACKUP_S3_ENDPOINT}"
export RCLONE_CONFIG_BACKUP_REGION="${BACKUP_S3_REGION}"
export RCLONE_CONFIG_BACKUP_FORCE_PATH_STYLE=true

prefix="ficonter/${stamp}"

echo "Uploading database backup to private off-site storage..."
rclone copy "${db_dir}" "backup:${BACKUP_S3_BUCKET}/${prefix}/database" --s3-no-check-bucket
rclone copy "${manifest_dir}" "backup:${BACKUP_S3_BUCKET}/${prefix}/manifest" --s3-no-check-bucket

echo "Discovering and copying Supabase Storage buckets..."
mapfile -t buckets < <(rclone lsd supabase: | awk '{$1=$2=$3=$4=""; sub(/^ +/, ""); print}' | sed '/^$/d')

if [[ ${#buckets[@]} -eq 0 ]]; then
  echo "No Supabase Storage buckets were discovered; refusing to mark backup successful." >&2
  exit 4
fi

for bucket in "${buckets[@]}"; do
  echo "Backing up Storage bucket: ${bucket}"
  rclone copy "supabase:${bucket}" "backup:${BACKUP_S3_BUCKET}/${prefix}/storage/${bucket}" --s3-no-check-bucket
  rclone check "supabase:${bucket}" "backup:${BACKUP_S3_BUCKET}/${prefix}/storage/${bucket}" --size-only --one-way
  printf '%s\n' "${bucket}" >> "${manifest_dir}/storage-buckets.txt"
done

rclone copy "${manifest_dir}" "backup:${BACKUP_S3_BUCKET}/${prefix}/manifest" --s3-no-check-bucket

echo "Secure FICONTER backup completed: ${prefix}"
