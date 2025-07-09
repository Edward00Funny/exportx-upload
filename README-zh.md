# ExportX 自托管上传器

这是一个专为 [ExportX Figma 插件](https://exportx.dev/) 设计的自托管、多平台图片上传服务。

通过自行部署此服务，您可以安全地将 Figma 资源直接上传到您自己的云存储（如 Cloudflare R2 或 AWS S3），无需与第三方服务共享任何敏感凭据。

[🇺🇸 English](README.md) | [🇨🇳 中文](README-zh.md)

## 特性

- **自托管且安全**：您的凭据完全由您掌控。
- **多平台支持**：一键部署到 Cloudflare Workers、Docker、AWS Lambda 或 Google Cloud Run。
- **灵活的存储**：轻松配置使用 Cloudflare R2、AWS S3 或其他兼容 S3 的服务。
- **团队就绪**：支持多个身份验证令牌，适用于团队使用。

---

## 部署

选择最适合您需求的平台。
 
### 1. Cloudflare Workers（推荐）

[![部署到 Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Edward00Funny/exportx-upload)

这是最简单且最具成本效益的入门方式。

**前置要求：**
- 一个 [Cloudflare 账户](https://dash.cloudflare.com/sign-up)。
- 已安装并配置的 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)（`wrangler login`）。
- 已创建的 R2 存储桶。

**步骤：**

1.  **克隆此仓库：**
    ```bash
    git clone https://github.com/your-username/exportx-upload.git
    cd exportx-upload
    ```

2.  **配置 `wrangler.jsonc`：**
    - 将 `wrangler.jsonc.example` 重命名为 `wrangler.jsonc`（如果适用）。
    - 设置您的 worker `name` 和 `account_id`。
    - 在 `[vars]` 段落下配置你的存储桶和认证信息。关于如何配置，请参考 `wrangler.jsonc` 文件中的注释。
    - 配置您的 R2 存储桶绑定：
      ```json
      [[r2_buckets]]
      binding = "R2_BUCKET"
      bucket_name = "您的r2存储桶名称"
      ```

3.  **部署：**
    ```bash
    pnpm install
    pnpm run deploy
    ```
    Wrangler 将为您提供已部署 worker 的 URL。

### 2. Docker（Google Cloud Run、DigitalOcean 等）


![Docker Image Version](https://img.shields.io/docker/v/exportxabfree/exportx-upload%3Adev)


使用此方法在任何支持 Docker 容器的平台上部署服务。

**前置要求：**
- 已安装 [Docker](https://www.docker.com/get-started)。

**步骤：**

1.  **拉取 Docker 镜像：**
    ```bash
    docker pull exportxabfree/exportx-upload:dev
    ```

2.  **运行容器：**
    使用 `-e` 标志提供所有必要的环境变量。
    ```bash
    docker run --rm -p 8080:8080 \
      -e AUTH_SECRET_KEY="your_secure_secret_key" \
      -e BUCKET_main_r2_PROVIDER="CLOUDFLARE_R2" \
      -e BUCKET_main_r2_BINDING_NAME="R2_MAIN_BUCKET" \
      -e BUCKET_main_r2_ID_WHITELIST="your-user-id" \
      -v /path/to/your/cloudflare/creds:/root/.wrangler \
      exportx-upload:latest
    ```
    您的服务将在 `http://localhost:8080` 可用。

---

## 配置

### 存储桶配置 (Bucket Configuration)

从 v2.0 开始，存储桶配置使用 JSON 格式，这让配置更加清晰和易于管理。

#### 环境变量

设置 `BUCKET_CONFIGS` 环境变量，值为 JSON 数组：

```bash
BUCKET_CONFIGS='[
  {
    "id": "personal_aws",
    "name": "个人 AWS 存储",
    "provider": "AWS_S3",
    "bucketName": "my-personal-bucket",
    "accessKeyId": "your-access-key",
    "secretAccessKey": "your-secret-key",
    "region": "us-east-1",
    "endpoint": "https://s3.amazonaws.com",
    "customDomain": "https://images.example.com",
    "allowedPaths": ["images", "documents"],
    "idWhitelist": ["user1", "user2"]
  },
  {
    "id": "main_r2",
    "name": "主要 R2 存储",
    "provider": "CLOUDFLARE_R2",
    "bindingName": "R2_MAIN_BINDING",
    "customDomain": "https://files.example.com",
    "allowedPaths": ["*"],
    "idWhitelist": ["admin"]
  }
]'
```

#### 配置字段说明

- `id`: 存储桶的唯一标识符，用于 API 调用
- `name`: 用户友好的显示名称（可选）
- `provider`: 存储提供商，支持 `AWS_S3` 和 `CLOUDFLARE_R2`
- `bucketName`: 实际的存储桶名称（S3 需要）
- `accessKeyId`: 访问密钥 ID（S3 需要）
- `secretAccessKey`: 访问密钥（S3 需要）
- `region`: 存储桶区域（S3 需要）
- `endpoint`: 存储桶端点 URL（S3 需要）
- `customDomain`: 自定义域名（可选）
- `bindingName`: R2 绑定名称（R2 需要）
- `allowedPaths`: 允许的路径列表，如 `["images", "documents"]` 或 `["*"]`
- `idWhitelist`: 用户 ID 白名单

#### 与旧版本的区别

**旧版本（v1.x）：**
```bash
# 需要为每个存储桶设置多个环境变量
BUCKET_wasabi_storage_PROVIDER="AWS_S3"
BUCKET_wasabi_storage_BUCKET_NAME="my-bucket"
BUCKET_wasabi_storage_ACCESS_KEY_ID="..."
BUCKET_wasabi_storage_SECRET_ACCESS_KEY="..."
# ... 更多环境变量
```

**新版本（v2.0+）：**
```bash
# 只需要一个 JSON 配置
BUCKET_CONFIGS='[{"id": "wasabi_storage", "provider": "AWS_S3", ...}]'
```

#### 优势

1. **更清晰的配置**：不再有多个"bucket"概念的混乱
2. **环境变量更少**：从每个存储桶 10+ 个环境变量减少到 1 个
3. **更好的可维护性**：JSON 格式更易于理解和管理
4. **更灵活的结构**：支持嵌套配置和复杂数据类型

### 其他配置

#### 认证配置

```bash
AUTH_SECRET_KEY="your-secret-key"
```

#### 可选配置

```bash
# 服务器端口（仅 Docker）
PORT="8080"

# 已废弃的全局自定义域名
CUSTOM_DOMAIN="https://images.example.com"
```

---

# API 端点

所有端点都需要 `Authorization: Bearer {AUTH_SECRET_KEY}` 请求头。

## `GET /`

健康检查端点。

## `GET /buckets`

获取所有已配置存储桶的公开信息。

**请求头**

| Header | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | `string` | 是 | Bearer Token。格式为 `Bearer {AUTH_SECRET_KEY}`。 |
| `X-User-Id` | `string` | 是 | 发起请求的用户的ID。用于用户ID白名单验证。 |

**成功响应**

```json
{
  "success": true,
  "buckets": [
    {
      "name": "wasabi_storage",
      "provider": "AWS_S3",
      "bucketName": "freeze-page-1251054923",
      "region": "ap-singapore",
      "endpoint": "https://cos.ap-singapore.myqcloud.com",
      "customDomain": "",
      "alias": "私人存储",
      "allowedPaths": [
        "images",
        "photos",
        "avatars"
      ]
    }
  ]
}
```
## `POST /upload`

上传文件到指定的存储桶。

**请求体 (`multipart/form-data`)**

| 字段 | 类型 | 是否必需 | 描述 |
| :--- | :--- | :--- | :--- |
| `file` | `File` | 是 | 要上传的文件。 |
| `path` | `string` | 是 | 上传的目标路径。例如, `images` 或 `user/avatars`。 |
| `bucket` | `string` | 是 | 目标存储桶的逻辑名称 (例如, `main_r2`)。 |
| `fileName` | `string` | 否 | 可选的文件名。如果未提供，将使用文件的原始名称。 |
| `overwrite` | `string` | 否 | 是否覆盖同路径下的同名文件。值为字符串 `'true'` 时生效。 |


**请求头**

| Header | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | `string` | 是 | Bearer Token。格式为 `Bearer {AUTH_SECRET_KEY}`。 |
| `X-User-Id` | `string` | 是 | 发起请求的用户的ID。用于用户ID白名单验证。 |

**成功响应**
```json
{
  "url": "https://your-custom-domain.com/path/to/your/file.png",
  "fileName": "file.png"
}
```

**错误响应**

- `400 Bad Request`: 请求缺少必需的参数。
- `401 Unauthorized`: 认证失败。
- `403 Forbidden`: 用户ID不在白名单中。
- `500 Internal Server Error`: 服务器内部错误或配置错误。



## 许可证

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.