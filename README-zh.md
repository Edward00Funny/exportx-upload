# ExportX 自托管上传器

这是一个专为 [ExportX Figma 插件](https://exportx.dev/) 设计的自托管、多平台图片上传服务。

通过自行部署此服务，您可以安全地将 Figma 资源直接上传到您自己的云存储（如 Cloudflare R2 或 AWS S3），无需与第三方服务共享任何敏感凭据。

英文版：[README.md](README.md) | 中文版：[README-zh.md](README-zh.md)

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
    - 配置您的 R2 存储桶绑定：
      ```json
      [[r2_buckets]]
      binding = "R2_BUCKET"
      bucket_name = "您的r2存储桶名称"
      ```

3.  **设置环境变量：**
    打开 `wrangler.jsonc` 并将您的密钥添加到 `[vars]` 部分。
    ```json
    [vars]
    AUTH_TOKEN = "您的figma密钥令牌"
    STORAGE_PROVIDER = "R2"
    ```

4.  **部署：**
    ```bash
    pnpm install
    pnpm run deploy
    ```
    Wrangler 将为您提供已部署 worker 的 URL。

### 2. Docker（Google Cloud Run、DigitalOcean 等）

使用此方法在任何支持 Docker 容器的平台上部署服务。

**前置要求：**
- 已安装 [Docker](https://www.docker.com/get-started)。

**步骤：**

1.  **构建 Docker 镜像：**
    ```bash
    docker build -t exportx-uploader .
    ```

2.  **运行容器：**
    使用 `-e` 标志提供所有必要的环境变量。
    ```bash
    docker run -d -p 3000:3000 \
      -e PORT=3000 \
      -e AUTH_TOKEN="您的密钥令牌,队友的另一个令牌" \
      -e STORAGE_PROVIDER="S3" \
      -e AWS_ACCESS_KEY_ID="您的aws密钥id" \
      -e AWS_SECRET_ACCESS_KEY="您的aws密钥" \
      -e AWS_S3_BUCKET="您的s3存储桶名称" \
      -e AWS_S3_REGION="您的s3存储桶区域" \
      --name exportx-uploader-instance \
      exportx-uploader
    ```
    您的服务将在 `http://localhost:3000` 可用。

---

## 配置

该服务完全通过环境变量进行配置。

| 变量                      | 示例值                                              | 必需 | 描述                                                                                           |
| ------------------------- | -------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `STORAGE_PROVIDER`        | `CLOUDFLARE_R2`或`AWS_S3`                                   | 是   | 存储提供商类型。                                                                               |
| `S3_ACCESS_KEY_ID`        | `your_ak_string`                                  | 否   | S3兼容存储的Access Key。                                                                      |
| `S3_SECRET_ACCESS_KEY`    | `your_sk_string`                                  | 否   | S3兼容存储的Secret Key。                                                                      |
| `S3_BUCKET_NAME`          | `my-image-bucket`                                 | 否   | 存储桶名称。                                                                                   |
| `S3_ENDPOINT`             | `https://<accountid>.r2.cloudflarestorage.com`   | 否   | 存储服务的Endpoint。                                                                          |
| `AUTH_TYPE`               | `TOKEN_AND_EMAIL_WHITELIST`                      | 是   | 认证类型。明确指定使用"密钥+白名单"模式。其他可选值可以是TOKEN（仅密钥）。                      |
| `AUTH_SECRET_KEY`         | `a_very_long_and_secure_string`                  | 是   | 共享认证密钥。用于验证请求来源的合法性。                                                       |
| `EMAIL_WHITELIST`         | `user1@co.com,user2@co.com`                      | 否   | 邮箱白名单。当AUTH_TYPE为TOKEN_AND_EMAIL_WHITELIST时必填。逗号分隔的邮箱列表。                 |
| `CUSTOM_DOMAIN`           | `https://images.mycompany.com`                    | 否   | 自定义访问域名。                                                                               |
| `ALLOWED_ORIGINS`         | `https://www.figma.com`                           | 否   | 允许的跨域访问来源。                                                                           |
| `PORT`                    | `8080`                                            | 否   | Node.js 服务器监听的端口。默认为 `3000`。（仅Docker）                                         |

---

## API 使用

### 上传文件

- **端点**: `POST /upload`
- **内容类型**: `multipart/form-data`

#### 请求头

| Header | 类型 | 必需 | 描述 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | Bearer Token 认证。格式为 `Bearer <您的密钥令牌>`。 |
| `X-User-Email` | `string` | 否 | 发起请求的 Figma 用户的邮箱。当 `AUTH_TYPE` 设置为 `TOKEN_AND_EMAIL_WHITELIST` 时此项为必需，用于邮箱白名单验证。 |

#### 请求体 (`multipart/form-data`)

| 字段 | 类型 | 必需 | 描述 |
| :--- | :--- | :--- | :--- |
| `file` | `File` | 是 | 需要上传的二进制文件内容。 |
| `path` | `string` | 否 | 文件在存储桶中存放的相对目录路径，例如 `icons/`。如果提供，请确保以 `/` 结尾。该路径会自动进行清理，以防止路径遍历攻击。 |
| `fileName` | `string` | 否 | 自定义文件名（包含扩展名）。如果未提供，系统将自动生成一个基于时间戳和原始文件名的唯一名称。 |
| `overwrite` | `boolean` | 否 | 是否允许覆盖同路径下的同名文件。接受 `true` 或 `false` 字符串。默认为 `false`，如果文件已存在会返回错误，以防意外覆盖。 |

#### 使用 `curl` 的示例

**1. 基础上传**
```bash
curl -X POST \
  -H "Authorization: Bearer 您的密钥令牌" \
  -F "file=@/path/to/your/image.png" \
  https://您的服务url/upload
```

**2. 上传到指定目录并允许覆盖**
```bash
curl -X POST \
  -H "Authorization: Bearer 您的密钥令牌" \
  -H "X-User-Email: user@example.com" \
  -F "file=@/path/to/icon.svg" \
  -F "path=icons/" \
  -F "fileName=logo.svg" \
  -F "overwrite=true" \
  https://您的服务url/upload
```

#### 成功响应 (`200 OK`)

响应为一个 JSON 对象，包含了上传后文件的信息。
```json
{
  "url": "https://images.mycompany.com/icons/logo.svg",
  "fileName": "icon.svg"
}
```

| 字段 | 类型 | 描述 |
| :--- | :--- | :--- |
| `url` | `string` | 文件的完整可访问 URL。如果配置了 `CUSTOM_DOMAIN`，将使用自定义域名作为基础 URL。否则，将根据存储提供商生成相应的 URL（例如 S3 的公开访问 URL）。 |
| `fileName` | `string` | 上传时原始文件的名称。 |


返回的 `url` 是访问文件的路径。在 Figma 插件中，您应该通过在服务域名前添加前缀来构建完整的 URL。对于 S3，返回完整的公共 URL。

```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[要根据您的 Worker 配置生成/同步类型，请运行](https://developers.cloudflare.com/workers/wrangler/commands/#types)：

```txt
npm run cf-typegen
```

在实例化 `Hono` 时将 `CloudflareBindings` 作为泛型传递：

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
``` 

## 填写帮助

### 腾讯云COS



```

```