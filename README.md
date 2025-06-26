# ExportX Self-Hosted Uploader

This is a self-hosted, multi-platform image uploading service designed for the [ExportX Figma plugin](https://exportx.dev/).

By deploying this service yourself, you can securely upload your Figma assets directly to your own cloud storage (like Cloudflare R2 or AWS S3) without sharing any sensitive credentials with a third-party service.

English version: [README.md](README.md) | Chinese version: [README-zh.md](README-zh.md)

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

The service is configured entirely through environment variables.

| Variable                | Required                               | Description                                                                                                   | Example                                         |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `AUTH_TOKEN`            | **Yes**                                | A secret Bearer token for authentication. Can be a single token or a comma-separated list for multiple users. | `my-secret` or `token1,token2`                  |
| `STORAGE_PROVIDER`      | **Yes**                                | Specifies the storage backend. Currently supports `R2` and `S3`.                                              | `R2`                                            |
| `PORT`                  | No (for Docker)                        | The port for the Node.js server to listen on. Defaults to `3000`.                                             | `8080`                                          |
| `R2_BUCKET`             | Yes (for `R2`)                         | Cloudflare R2 bucket binding. Set automatically via `wrangler.jsonc`.                                         | (Handled by Cloudflare)                         |
| `AWS_ACCESS_KEY_ID`     | Yes (for `S3`)                         | Your AWS Access Key ID.                                                                                       | `AKIAIOSFODNN7EXAMPLE`                          |
| `AWS_SECRET_ACCESS_KEY` | Yes (for `S3`)                         | Your AWS Secret Access Key.                                                                                   | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`      |
| `AWS_S3_BUCKET`         | Yes (for `S3`)                         | The name of your S3 bucket.                                                                                   | `my-figma-assets-bucket`                        |
| `AWS_S3_REGION`         | Yes (for `S3`)                         | The AWS region where your bucket is located.                                                                  | `us-east-1`                                     |

---

## API Usage

### Upload File

- **Endpoint**: `POST /upload`
- **Content-Type**: `multipart/form-data`

#### Headers

| Header          | Type     | Required | Description                                                                                                      |
| :-------------- | :------- | :------- | :--------------------------------------------------------------------------------------------------------------- |
| `Authorization` | `string` | Yes      | Bearer Token authentication. Format: `Bearer <YOUR_AUTH_TOKEN>`.                                                   |
| `X-User-Email`  | `string` | No       | The email of the Figma user making the request. Required when `AUTH_TYPE` is `TOKEN_AND_EMAIL_WHITELIST` for whitelist validation. |

#### Request Body (`multipart/form-data`)

| Field       | Type      | Required | Description                                                                                                                             |
| :---------- | :-------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `file`      | `File`    | Yes      | The binary content of the file to upload.                                                                                               |
| `path`      | `string`  | No       | The relative directory path in the bucket to store the file, e.g., `icons/`. The path is sanitized to prevent path traversal attacks.      |
| `fileName`  | `string`  | No       | A custom file name (including extension). If not provided, a unique name based on a timestamp and the original filename will be generated. |
| `overwrite` | `boolean` | No       | Whether to allow overwriting an existing file at the same path. Accepts a string of `true` or `false`. Defaults to `false` to prevent accidental overwrites by returning an error if the file exists. |

#### Example `curl` Usage

**1. Basic Upload**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F "file=@/path/to/your/image.png" \
  https://your-service-url/upload
```

**2. Upload to a Specific Directory with Overwrite Enabled**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "X-User-Email: user@example.com" \
  -F "file=@/path/to/icon.svg" \
  -F "path=icons/" \
  -F "fileName=logo.svg" \
  -F "overwrite=true" \
  https://your-service-url/upload
```

#### Success Response (`200 OK`)

The response is a JSON object containing information about the uploaded file.
```json
{
  "url": "https://images.mycompany.com/icons/logo.svg",
  "fileName": "icon.svg"
}
```

| Field      | Type     | Description                                                                                                                                                             |
| :--------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`      | `string` | The full, accessible URL of the file. If `CUSTOM_DOMAIN` is configured, it will be used as the base URL. Otherwise, a corresponding URL will be generated based on the storage provider (e.g., a public S3 URL). |
| `fileName` | `string` | The original name of the uploaded file.                                                                                                                               |


The returned `url` is the path to access the file. In the Figma plugin, you should construct the full URL by prepending your service's domain. For S3, a full public URL is returned.

```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
