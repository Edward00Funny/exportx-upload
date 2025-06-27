# ExportX Self-Hosted Uploader

This is a self-hosted, multi-platform image uploading service designed for the [ExportX Figma plugin](https://exportx.dev/).

By deploying this service yourself, you can securely upload your Figma assets directly to your own cloud storage (like Cloudflare R2 or AWS S3) without sharing any sensitive credentials with a third-party service.

[🇺🇸 English](README.md) | [🇨🇳 中文](README-zh.md)

## Features

- **Self-Hosted & Secure**: Your credentials stay with you.
- **Multi-Platform**: Deploy with one click to Cloudflare Workers, Docker, AWS Lambda, or Google Cloud Run.
- **Flexible Storage**: Easily configure to use Cloudflare R2, AWS S3, or other S3-compatible services.
- **Team Ready**: Supports multiple authentication tokens for team usage.

---

## Deployment

Choose the platform that best suits your needs.

### 1. Cloudflare Workers (Recommended)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Edward00Funny/exportx-upload)


This is the easiest and most cost-effective way to get started.

**Prerequisites:**
- A [Cloudflare account](https://dash.cloudflare.com/sign-up).
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and configured (`wrangler login`).
- An R2 bucket created.

**Steps:**

1.  **Clone this repository:**
    ```bash
    git clone https://github.com/your-username/exportx-upload.git
    cd exportx-upload
    ```

2.  **Configure `wrangler.jsonc`:**
    - Rename `wrangler.jsonc.example` to `wrangler.jsonc` (if applicable).
    - Set your worker `name` and `account_id`.
    - Configure your R2 bucket binding:
      ```json
      [[r2_buckets]]
      binding = "R2_BUCKET"
      bucket_name = "your-r2-bucket-name"
      ```

3.  **Set environment variables:**
    Open `wrangler.jsonc` and add your secrets to the `[vars]` section.
    ```json
    [vars]
    AUTH_TOKEN = "your-secret-token-for-figma"
    STORAGE_PROVIDER = "R2"
    ```

4.  **Deploy:**
    ```bash
    pnpm install
    pnpm run deploy
    ```
    Wrangler will give you the URL of your deployed worker.

### 2. Docker (Google Cloud Run, DigitalOcean, etc.)

Use this method to deploy the service on any platform that supports Docker containers.

**Prerequisites:**
- [Docker](https://www.docker.com/get-started) installed.

**Steps:**

1.  **Build the Docker image:**
    ```bash
    docker build -t exportx-uploader .
    ```

2.  **Run the container:**
    Provide all necessary environment variables using the `-e` flag.
    ```bash
    docker run -d -p 3000:3000 \
      -e PORT=3000 \
      -e AUTH_TOKEN="your-secret-token,another-token-for-teammate" \
      -e STORAGE_PROVIDER="S3" \
      -e AWS_ACCESS_KEY_ID="your-aws-key-id" \
      -e AWS_SECRET_ACCESS_KEY="your-aws-secret-key" \
      -e AWS_S3_BUCKET="your-s3-bucket-name" \
      -e AWS_S3_REGION="your-s3-bucket-region" \
      --name exportx-uploader-instance \
      exportx-uploader
    ```
    Your service will be available at `http://localhost:3000`.

---

## Configuration

This service is configured entirely through environment variables. Please refer to the comments in `wrangler.jsonc` for detailed configuration.

### Bucket Configuration

| Variable | Example Value | Required | Description |
| --- | --- | --- | --- |
| `BUCKET_{name}_*` | | Yes | Defines a bucket. For example, `BUCKET_main_r2_PROVIDER`. See `wrangler.jsonc` for details. |
| `BUCKET_{name}_ALLOWED_PATHS` | `images,public` | No | List of allowed upload paths, comma-separated. `*` allows all paths. |
| `BUCKET_{name}_EMAIL_WHITELIST` | `user1@example.com,user2@example.com` | No | Email whitelist for this bucket, comma-separated. This whitelist is required for the bucket to be accessible. |

### Global Authentication Configuration

| Environment Variable | Example Value | Required | Description |
| --- | --- | --- | --- |
| `AUTH_SECRET_KEY` | `a_very_long_and_secure_string` | Yes | Shared secret key for validating request legitimacy. Can be one or more keys, comma-separated. |
| `PORT` | `8080` | No | Node.js server listening port (Docker only). |

---

### API Endpoints

All endpoints require an `Authorization: Bearer {AUTH_SECRET_KEY}` header.

#### `GET /`

Health check endpoint.

#### `GET /buckets`

Retrieves public information for all configured buckets.

#### `POST /upload?bucket={bucket_name}`

Uploads a file to the specified bucket.

- **`bucket_name`** (Query parameter, required): The logical name of the target bucket (e.g., `main_r2`).

##### Request Body (`multipart/form-data`)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | `File` | Yes | The file to upload. |
| `path` | `string` | Yes | The target path for the upload. E.g., `images` or `user/avatars`. |
| `fileName` | `string` | No | Optional filename. If not provided, the original filename is used. |
| `overwrite` | `string` | No | If `true`, overwrites the file if it exists at the same path. |

##### Headers

| Header | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | `string` | Yes | Bearer Token. Format: `Bearer {AUTH_SECRET_KEY}`. |
| `X-User-Email` | `string` | Yes | The email of the user making the request. Required for email whitelist validation. |

##### Success Response (`200 OK`)
```json
{
  "url": "https://your-custom-domain.com/path/to/your/file.png",
  "fileName": "file.png"
}
```

##### Error Responses

- `400 Bad Request`: Missing required parameters.
- `401 Unauthorized`: Authentication failed.
- `403 Forbidden`: Email not in whitelist.
- `500 Internal Server Error`: Server-side or configuration error.

```txt
npm install
npm run dev
```